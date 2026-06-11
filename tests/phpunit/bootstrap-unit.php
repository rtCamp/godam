<?php
/**
 * Bootstrap for fast unit tests (Brain Monkey, no WordPress loaded).
 *
 * @package GoDAM
 */

declare(strict_types=1);

require dirname( __DIR__, 2 ) . '/vendor/autoload.php';

// Define commonly-checked constants so plugin files don't fatal on load.
defined( 'ABSPATH' ) || define( 'ABSPATH', '/tmp/abspath/' );
defined( 'WPINC' ) || define( 'WPINC', 'wp-includes' );

// Brain Monkey set-up/tear-down happens per-test in GoDAM\Tests\TestCase.
