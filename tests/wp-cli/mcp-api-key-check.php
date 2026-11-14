<?php
/**
 * Checks that no GoDAM ability returns the GoDAM API key or account token.
 *
 * Runs every read ability of GoDAM and GoDAM for Woo (namespaces `godam` and
 * `godam-woo`) on a real WordPress site, as an administrator, with a made-up
 * API key and account token stored. Each ability's output and error text is
 * searched for both values. Outside HTTP requests are blocked for the run and
 * answered with an error, so nothing reaches GoDAM Central or the analytics
 * service. The stored key, token and cached account data are put back after.
 *
 * Needs WordPress 6.9+ (Abilities API) and an administrator user.
 *
 * Run on a test site, never on production:
 *   wp eval-file tests/wp-cli/mcp-api-key-check.php --user=<admin>
 *
 * Exits 1 and lists the abilities when any output contains the key or token.
 *
 * @package GoDAM
 */

// phpcs:disable WordPress.WP.AlternativeFunctions, WordPress.PHP.DevelopmentFunctions -- a WP-CLI test script, not plugin code.

if ( ! defined( 'WP_CLI' ) || ! function_exists( 'wp_get_abilities' ) ) {
	echo "Run with wp eval-file on a WordPress 6.9+ site.\n";
	return;
}

if ( ! current_user_can( 'manage_options' ) ) {
	WP_CLI::error( 'Run as an administrator: add --user=<admin>.' );
}

$godam_check_key   = 'GODAMTESTKEY' . wp_generate_password( 20, false );
$godam_check_token = 'GODAMTESTTOKEN' . wp_generate_password( 20, false );
$godam_check_saved = array();

foreach ( array( 'rtgodam-api-key', 'rtgodam-account-token', 'rtgodam_user_data' ) as $godam_check_option ) {
	$godam_check_saved[ $godam_check_option ] = get_option( $godam_check_option, null );
}

update_option( 'rtgodam-api-key', $godam_check_key );
update_option( 'rtgodam-account-token', $godam_check_token );
update_option(
	'rtgodam_user_data',
	array(
		'currentUserId'  => get_current_user_id(),
		'valid_api_key'  => true,
		'api_key_status' => 'valid',
		'user_data'      => array( 'masked_api_key' => '****' ),
		'timestamp'      => time(),
	)
);

$godam_check_http = array();

add_filter(
	'pre_http_request',
	function ( $preempt, $args, $url ) use ( &$godam_check_http ) {
		$godam_check_http[] = $url;

		return array(
			'headers'  => array(),
			'body'     => wp_json_encode( array( 'message' => 'Blocked by the API key check.' ) ),
			'response' => array(
				'code'    => 503,
				'message' => 'Service Unavailable',
			),
			'cookies'  => array(),
			'filename' => null,
		);
	},
	10,
	3
);

/**
 * Builds an input for an ability from its schema: the first media item, the
 * first product, or a plain value for each required property.
 *
 * @param array $schema Input schema.
 * @return array
 */
function godam_check_input( $schema ) {
	static $media_id = null, $product_id = null;

	if ( null === $media_id ) {
		$media      = get_posts(
			array(
				'post_type'   => 'attachment',
				'post_status' => 'inherit',
				'numberposts' => 1,
				'fields'      => 'ids',
			)
		);
		$media_id   = $media ? (int) $media[0] : 1;
		$products   = post_type_exists( 'product' ) ? get_posts(
			array(
				'post_type'   => 'product',
				'numberposts' => 1,
				'fields'      => 'ids',
			)
		) : array();
		$product_id = $products ? (int) $products[0] : 1;
	}

	$input = array();

	foreach ( (array) ( $schema['required'] ?? array() ) as $name ) {
		$property = $schema['properties'][ $name ] ?? array();
		$type     = is_array( $property['type'] ?? null ) ? $property['type'][0] : ( $property['type'] ?? 'string' );

		if ( false !== strpos( $name, 'product' ) ) {
			$input[ $name ] = $product_id;
		} elseif ( 'integer' === $type || 'number' === $type ) {
			$input[ $name ] = $media_id;
		} elseif ( ! empty( $property['enum'] ) ) {
			$input[ $name ] = $property['enum'][0];
		} elseif ( 'array' === $type ) {
			$input[ $name ] = array( $media_id );
		} elseif ( 'boolean' === $type ) {
			$input[ $name ] = false;
		} else {
			$input[ $name ] = 'test';
		}
	}

	return $input;
}

$godam_check_leaks = array();
$godam_check_count = 0;

foreach ( wp_get_abilities() as $godam_check_ability ) {
	$godam_check_name = $godam_check_ability->get_name();
	$godam_check_ns   = strtok( $godam_check_name, '/' );
	$godam_check_meta = $godam_check_ability->get_meta();

	if ( ! in_array( $godam_check_ns, array( 'godam', 'godam-woo' ), true ) || empty( $godam_check_meta['annotations']['readonly'] ) ) {
		continue;
	}

	$godam_check_inputs = array( godam_check_input( (array) $godam_check_ability->get_input_schema() ) );

	// Each ability also runs once with an input that fails, so error text is checked too.
	$godam_check_inputs[] = array( 'id' => 999999999 );

	foreach ( $godam_check_inputs as $godam_check_input ) {
		++$godam_check_count;
		$godam_check_result = $godam_check_ability->execute( $godam_check_input ? $godam_check_input : null );
		$godam_check_text   = is_wp_error( $godam_check_result )
			? $godam_check_result->get_error_code() . ' ' . implode( ' ', $godam_check_result->get_error_messages() ) . ' ' . wp_json_encode( $godam_check_result->get_error_data() )
			: (string) wp_json_encode( $godam_check_result );

		if ( false !== strpos( $godam_check_text, $godam_check_key ) || false !== strpos( $godam_check_text, $godam_check_token ) ) {
			$godam_check_leaks[] = $godam_check_name;
		}
	}
}

foreach ( $godam_check_saved as $godam_check_option => $godam_check_value ) {
	if ( null === $godam_check_value ) {
		delete_option( $godam_check_option );
	} else {
		update_option( $godam_check_option, $godam_check_value );
	}
}

WP_CLI::log( sprintf( 'Ran %d read-ability calls. Outside requests blocked: %d.', $godam_check_count, count( $godam_check_http ) ) );

if ( $godam_check_leaks ) {
	WP_CLI::error( 'The API key or account token appeared in: ' . implode( ', ', array_unique( $godam_check_leaks ) ) );
}

WP_CLI::success( 'No ability output or error contained the API key or account token.' );
