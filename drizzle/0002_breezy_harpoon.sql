ALTER TABLE `orders` ADD `paymentMethod` enum('dinheiro','pix','cartao') NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `needsChange` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `cashReceivedCents` int;--> statement-breakpoint
ALTER TABLE `orders` ADD `changeCents` int;