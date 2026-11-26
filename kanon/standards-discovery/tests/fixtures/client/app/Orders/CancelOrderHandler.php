<?php

declare(strict_types=1);

namespace App\Orders;

use Illuminate\Support\Facades\DB;

final class CancelOrderHandler
{
    public function handle(CancelOrder $command): void
    {
        DB::transaction(fn () => Order::find($command->orderId)?->cancel());
    }
}
