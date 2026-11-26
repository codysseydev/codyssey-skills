<?php

declare(strict_types=1);

namespace App\Orders;

use Illuminate\Support\Facades\DB;

final class CreateOrderHandler
{
    public function handle(CreateOrder $command): void
    {
        DB::transaction(fn () => Order::find($command->orderId)?->create());
    }
}
