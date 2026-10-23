<?php

namespace App\Console\Commands;

use App\Models\Delivery;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Throwable;

class PruneDeliveries extends Command
{
    protected $signature = 'cartopia:prune-deliveries {--dry-run : Conta as entregas elegíveis sem excluí-las}';

    protected $description = 'Exclui entregas que chegaram há mais tempo que o prazo de retenção';

    public function handle(): int
    {
        $retentionDays = (int) config('deliveries.retention_days', 90);
        $batchSize = (int) config('deliveries.retention_batch_size', 100);

        if ($retentionDays < 1 || $batchSize < 1) {
            $this->error('A configuração de retenção é inválida.');

            return self::FAILURE;
        }

        $cutoff = CarbonImmutable::now('UTC')->subDays($retentionDays);
        $query = Delivery::query()
            ->whereNotNull('arrives_at')
            ->where('arrives_at', '<=', $cutoff);

        try {
            if ($this->option('dry-run')) {
                $eligible = $query->count();
                $this->info("{$eligible} entrega(s) elegível(is) para exclusão.");

                return self::SUCCESS;
            }

            $deleted = 0;
            $query->chunkById($batchSize, function ($deliveries) use (&$deleted): void {
                foreach ($deliveries as $delivery) {
                    if ($delivery->delete()) {
                        $deleted++;
                    }
                }
            });

            $this->info("{$deleted} entrega(s) excluída(s).");

            return self::SUCCESS;
        } catch (Throwable $exception) {
            report($exception);
            $this->error('Não foi possível concluir a limpeza das entregas.');

            return self::FAILURE;
        }
    }
}
