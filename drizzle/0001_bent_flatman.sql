CREATE TABLE `activity_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`activityType` varchar(100) NOT NULL,
	`durationMinutes` int,
	`caloriesBurned` int,
	`steps` int,
	`distanceKm` int,
	`loggedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `favorite_recipes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`recipeId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `favorite_recipes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `food_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`brand` varchar(255),
	`barcode` varchar(128),
	`servingSizeG` int,
	`servingSizeDescription` varchar(255),
	`caloriesPerServing` int,
	`proteinG` int,
	`carbsG` int,
	`fatG` int,
	`fiberG` int,
	`sugarG` int,
	`sodiumMg` int,
	`cholesterolMg` int,
	`vitaminAMcg` int,
	`vitaminCMg` int,
	`calciumMg` int,
	`ironMg` int,
	`imageUrl` text,
	`source` enum('user','barcode','ai','database') DEFAULT 'database',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `food_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `food_items_barcode_unique` UNIQUE(`barcode`)
);
--> statement-breakpoint
CREATE TABLE `food_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`foodItemId` int,
	`mealType` enum('breakfast','lunch','dinner','snack') NOT NULL,
	`foodName` varchar(255) NOT NULL,
	`servings` int DEFAULT 10,
	`totalCalories` int NOT NULL,
	`totalProteinG` int,
	`totalCarbsG` int,
	`totalFatG` int,
	`imageUrl` text,
	`notes` text,
	`loggedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `food_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recipes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`imageUrl` text,
	`prepTimeMinutes` int,
	`cookTimeMinutes` int,
	`servings` int DEFAULT 1,
	`totalCalories` int,
	`totalProteinG` int,
	`totalCarbsG` int,
	`totalFatG` int,
	`mealType` enum('breakfast','lunch','dinner','snack'),
	`dietaryPreference` enum('none','vegetarian','vegan','low_carb','high_protein','keto') DEFAULT 'none',
	`ingredients` text,
	`instructions` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `recipes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reminder_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`breakfastReminderEnabled` int DEFAULT 0,
	`breakfastReminderTime` varchar(5),
	`lunchReminderEnabled` int DEFAULT 0,
	`lunchReminderTime` varchar(5),
	`dinnerReminderEnabled` int DEFAULT 0,
	`dinnerReminderTime` varchar(5),
	`waterReminderEnabled` int DEFAULT 0,
	`waterReminderIntervalMinutes` int DEFAULT 60,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reminder_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `reminder_settings_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`gender` enum('male','female','other'),
	`birthDate` timestamp,
	`heightCm` int,
	`currentWeightKg` int,
	`targetWeightKg` int,
	`activityLevel` enum('sedentary','lightly_active','moderately_active','very_active','extra_active') DEFAULT 'sedentary',
	`goal` enum('lose_weight','maintain','gain_weight') DEFAULT 'maintain',
	`dailyCalorieTarget` int,
	`proteinPercentage` int DEFAULT 30,
	`carbsPercentage` int DEFAULT 40,
	`fatPercentage` int DEFAULT 30,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_profiles_userId_unique` UNIQUE(`userId`)
);
