<?php

namespace App\Services;

use App\Models\Delivery;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Crypt;

class ResolveDeliveryChallenge
{
    /** @return array{solved: bool, attempts_remaining: int, pattern?: string, guessed_letters?: array<int, string>, wrong_letters?: array<int, string>} */
    public function handle(Delivery $delivery, string $answer): array
    {
        if ($delivery->unlock_type === 'none' || $delivery->unlocked_at !== null) {
            return ['solved' => true, 'attempts_remaining' => $this->remaining($delivery->unlock_attempts)];
        }

        $maxAttempts = (int) config('deliveries.max_unlock_attempts');
        if ($delivery->unlock_attempts >= $maxAttempts) {
            return $this->hangmanResult($delivery, false, 0);
        }

        if ($delivery->unlock_type === 'hangman') {
            return $this->handleHangman($delivery, $answer);
        }

        if (Hash::check($answer, (string) $delivery->unlock_answer_hash)) {
            DB::table('deliveries')->where('id', $delivery->id)->update([
                'unlocked_at' => now('UTC'),
                'updated_at' => now('UTC'),
            ]);
            $delivery->refresh();

            return ['solved' => true, 'attempts_remaining' => $this->remaining($delivery->unlock_attempts)];
        }

        DB::table('deliveries')->where('id', $delivery->id)->increment('unlock_attempts');
        $delivery->refresh();

        return ['solved' => false, 'attempts_remaining' => $this->remaining($delivery->unlock_attempts)];
    }

    private function handleHangman(Delivery $delivery, string $answer): array
    {
        $letter = $this->normalizeHangmanAnswer($answer);
        $letter = str_replace(' ', '', $letter);
        if (strlen($letter) !== 1) return $this->hangmanResult($delivery, false, $this->remaining($delivery->unlock_attempts));

        $state = $delivery->unlock_state ?? ['guessed_letters' => []];
        $guessed = array_values(array_unique($state['guessed_letters'] ?? []));
        if (! in_array($letter, $guessed, true)) {
            $guessed[] = $letter;
            $answerText = Crypt::decryptString((string) $delivery->unlock_answer_encrypted);
            $attempts = $delivery->unlock_attempts + (str_contains($answerText, $letter) ? 0 : 1);
            $solved = count(array_filter(str_split(str_replace(' ', '', $answerText)), fn (string $value): bool => in_array($value, $guessed, true))) === count(array_filter(str_split(str_replace(' ', '', $answerText)), fn (string $value): bool => $value !== ''));
            DB::table('deliveries')->where('id', $delivery->id)->update([
                'unlock_state' => json_encode(['guessed_letters' => $guessed]),
                'unlock_attempts' => $attempts,
                'unlocked_at' => $solved ? now('UTC') : null,
                'updated_at' => now('UTC'),
            ]);
            $delivery->refresh();
        }

        return $this->hangmanResult($delivery, $delivery->unlocked_at !== null, $this->remaining($delivery->unlock_attempts));
    }

    /** @return array{solved: bool, attempts_remaining: int, pattern: string, guessed_letters: array<int, string>, wrong_letters: array<int, string>} */
    public function state(Delivery $delivery): array
    {
        return $this->hangmanResult($delivery, $delivery->unlocked_at !== null, $this->remaining($delivery->unlock_attempts));
    }

    private function hangmanResult(Delivery $delivery, bool $solved, int $remaining): array
    {
        if ($delivery->unlock_type !== 'hangman') return ['solved' => $solved, 'attempts_remaining' => $remaining];
        $answer = Crypt::decryptString((string) $delivery->unlock_answer_encrypted);
        $guessed = $delivery->unlock_state['guessed_letters'] ?? [];
        $pattern = implode(' ', array_map(fn (string $letter): string => $letter === ' ' ? '/' : (in_array($letter, $guessed, true) ? $letter : '_'), str_split($answer)));
        $wrong = array_values(array_filter($guessed, fn (string $letter): bool => ! str_contains($answer, $letter)));
        return ['solved' => $solved, 'attempts_remaining' => $remaining, 'pattern' => $pattern, 'guessed_letters' => $guessed, 'wrong_letters' => $wrong];
    }

    private function normalizeHangmanAnswer(string $answer): string
    {
        $answer = mb_strtoupper(transliterator_transliterate('Any-Latin; Latin-ASCII', trim($answer)));
        return preg_replace('/[^A-Z ]/', '', $answer) ?: '';
    }

    private function remaining(int $attempts): int
    {
        return max(0, (int) config('deliveries.max_unlock_attempts') - $attempts);
    }
}
