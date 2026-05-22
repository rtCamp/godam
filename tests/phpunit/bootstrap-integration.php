<?php
/**
 * Bootstrap for integration tests (boots WordPress via wp-phpunit).
 *
 * @package GoDAM
 */

declare(strict_types=1);

$_tests_dir = getenv( 'WP_TESTS_DIR' ) ?: rtrim( sys_get_temp_dir(), '/\\' ) . '/wordpress-tests-lib';

if ( ! file_exists( $_tests_dir . '/includes/functions.php' ) ) {
	echo "Could not find {$_tests_dir}/includes/functions.php. Run bin/install-wp-tests.sh first." . PHP_EOL;
	exit( 1 );
}

require_once $_tests_dir . '/includes/functions.php';

tests_add_filter(
	'muplugins_loaded',
	static function (): void {
		require dirname( __DIR__, 2 ) . '/godam.php';
	}
);

require $_tests_dir . '/includes/bootstrap.php';
