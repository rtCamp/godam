<?php
/**
 * Register REST API endpoints for the latest release post.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

/**
 * Class Release_Post
 */
class Release_Post extends Base {

	/**
	 * Get REST routes.
	 */
	public function get_rest_routes() {
		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/release-post',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_release_post' ),
						'permission_callback' => '__return_true',
					),
				),
			),
		);
	}

	/**
	 * Get the latest release post.
	 * 
	 * @return \WP_REST_Response
	 */
	public function get_release_post() {
		$transient_key = 'rtgodam_release_data';
		$cached        = get_transient( $transient_key );

		if ( false !== $cached ) {
			return new \WP_REST_Response( $cached, 200 );
		}

		// Fetch the latest post from remote (release post).
		$response      = wp_remote_get( RTGODAM_IO_API_BASE . '/wp-json/wp/v2/posts?categories=8&per_page=1&orderby=date&order=desc&_embed' );
		$response_code = wp_remote_retrieve_response_code( $response );

		if ( is_wp_error( $response ) || $response_code < 200 || $response_code >= 300 ) {
			return new \WP_Error( 'request_failed', 'Failed to fetch data', array( 'status' => 500 ) );
		}

		$body = wp_remote_retrieve_body( $response );
		$data = json_decode( $body, true );

		// If no post found, return an empty structure.
		if ( empty( $data ) ) {
			$result = array(
				'version'  => '',
				'features' => array(),
			);

			return new \WP_REST_Response( $result, 200 );
		}

		$post = $data[0];

		// Get post featured image URL (used as default).
		$image = '';
		if ( isset( $post['_embedded']['wp:featuredmedia'][0]['source_url'] ) ) {
			$image = $post['_embedded']['wp:featuredmedia'][0]['source_url'];
		}

		$content  = isset( $post['content']['rendered'] ) ? wp_kses_post( $post['content']['rendered'] ) : '';
		$features = $this->parse_features_from_content( $content, $image );

		$result = array(
			'version'  => RTGODAM_VERSION,
			'features' => $features,
		);

		set_transient( $transient_key, $result );
		
		return new \WP_REST_Response( $result, 200 );
	}

	/**
	 * Parse features from post content by extracting headings and their content.
	 *
	 * @param string $content The post content HTML.
	 * @param string $default_image Default image URL for features.
	 *
	 * @return array Array of features
	 */
	private function parse_features_from_content( $content, $default_image = '' ) {
		$features = array();

		// Creating DOMDocument to parse HTML content.
		$dom = new \DOMDocument();
		libxml_use_internal_errors( true );
		$dom->loadHTML( '<?xml encoding="UTF-8">' . $content, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD );
		libxml_clear_errors();

		// Find all headings for features.
		$xpath    = new \DOMXPath( $dom );
		$headings = $xpath->query( '//h2 | //h3 | //h4' );

		foreach ( $headings as $heading ) {
			// Naming convention used by DOMDocument internally.
			// phpcs:disable WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase
			$title   = trim( $heading->textContent );
			$classes = $heading->getAttribute( 'class' );
			
			if ( empty( $title ) || false === strpos( $classes, 'wp-block-heading' ) ) {
				continue;
			}

			$description   = '';
			$feature_image = $default_image;
			$next_element  = $heading->nextSibling;

			// Get the next sibling elements until the next heading.
			while ( $next_element && ! $this->is_heading( $next_element ) ) {
				if ( XML_ELEMENT_NODE === $next_element->nodeType ) {
					if (
						(
							'p' === $next_element->tagName ||
							'ul' === $next_element->tagName ||
							'ol' === $next_element->tagName
						) && ! empty( trim( $next_element->textContent ) )
					) {
						// Add and append element content.
						$html_content = $dom->saveHTML( $next_element );

						if ( empty( $description ) ) {
							$description = $html_content;
						} else {
							$description .= "\n" . $html_content;
						}
					} elseif (
						'figure' === $next_element->tagName && 
						false !== strpos( $next_element->getAttribute( 'class' ), 'wp-block-image' )
					) {
						// Extract image from figure element.
						$img = $xpath->query( './/img', $next_element );

						if ( $img->length > 0 ) {
							$feature_image = $img->item( 0 )->getAttribute( 'src' );
						}
					}
				}

				$next_element = $next_element->nextSibling;
			}

			// Skip features that have no description.
			if ( empty( $description ) ) {
				continue;
			}

			// Create feature object.
			$feature = array(
				// Trim the heading ID suffix added from original post.
				'id'          => trim( $heading->getAttribute( 'id' ), '-h' ),
				'title'       => sanitize_text_field( $title ),
				'description' => wp_kses_post( $description ),
				'image'       => esc_url( $feature_image ),
			);

			$features[] = $feature;
		}

		// Remove the last feature from the array,
		// as it's a summary or non-feature section.
		if ( ! empty( $features ) ) {
			array_pop( $features );
		}

		return $features;
	}

	/**
	 * Check if a DOM node is a heading element
	 *
	 * @param \DOMNode $node The DOM node to check.
	 *
	 * @return bool True if it's a heading
	 */
	private function is_heading( $node ) {
		if ( XML_ELEMENT_NODE !== $node->nodeType ) {
			return false;
		}

		$tag_name = strtolower( $node->tagName );
		return in_array( $tag_name, array( 'h2', 'h3', 'h4' ), true );
		// phpcs:enable WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase
	}
}
