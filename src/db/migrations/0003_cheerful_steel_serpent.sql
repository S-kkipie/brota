ALTER TABLE `users` ADD `web_token` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_web_token_unique` ON `users` (`web_token`);