<?php
/**
 * MCP abilities partial: Abilities_REST_Dispatch.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\MCP;

use RTGODAM\Inc\Media_Library\Media_Folder_Utils;
use RTGODAM\Inc\REST_API\Analytics;
use RTGODAM\Inc\REST_API\Media_Library;
use RTGODAM\Inc\REST_API\Site;
use RTGODAM\Inc\REST_API\Transcoding;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

defined( 'ABSPATH' ) || exit;

/**
 * Abilities_REST_Dispatch trait.
 */
trait Abilities_REST_Dispatch {

	/**
	 * Dispatch an analytics REST controller callback.
	 *
	 * @param string               $method Controller method.
	 * @param array<string, mixed> $params Request parameters.
	 * @return array<string, mixed>|WP_Error
	 */
	private function dispatch_analytics_callback( $method, array $params ) {
		$controller = Analytics::get_instance();
		$request    = new WP_REST_Request( 'GET' );

		foreach ( $params as $key => $value ) {
			$request->set_param( $key, $value );
		}

		$response = $controller->{$method}( $request );

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		if ( $response instanceof WP_REST_Response ) {
			return $response->get_data();
		}

		return is_array( $response ) ? $response : array();
	}

	/**
	 * Dispatch an input payload through the existing site REST controller.
	 *
	 * @param string               $method Site controller method.
	 * @param array<string, mixed> $params Request params.
	 * @return array<string, mixed>|WP_Error
	 */
	private function dispatch_site_callback( $method, array $params ) {
		$controller = Site::get_instance();
		$request    = new WP_REST_Request( 'GET' );

		foreach ( $params as $key => $value ) {
			$request->set_param( $key, $value );
		}

		$response = $controller->{$method}( $request );

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		if ( $response instanceof WP_REST_Response ) {
			return $response->get_data();
		}

		return is_array( $response ) ? $response : array();
	}

	/**
	 * Dispatch an input payload through the media library REST controller.
	 *
	 * @param string               $method Media library controller method.
	 * @param array<string, mixed> $params Request params.
	 * @param string               $http_method HTTP method.
	 * @return array<string, mixed>|WP_Error
	 */
	private function dispatch_media_library_callback( $method, array $params, $http_method = 'GET' ) {
		$controller = Media_Library::get_instance();
		$request    = new WP_REST_Request( $http_method );

		foreach ( $params as $key => $value ) {
			$request->set_param( $key, $value );
		}

		$response = $controller->{$method}( $request );

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		if ( $response instanceof WP_REST_Response ) {
			return $response->get_data();
		}

		return is_array( $response ) ? $response : array();
	}

	/**
	 * Normalize media folder ids from ability input.
	 *
	 * @param mixed $folder_ids Raw folder IDs.
	 * @return array<int>
	 */
	private function normalize_folder_ids( $folder_ids ) {
		if ( ! is_array( $folder_ids ) ) {
			return array();
		}

		return array_values( array_filter( array_map( 'absint', $folder_ids ) ) );
	}

	/**
	 * Build a normalized folder payload.
	 *
	 * @param int $folder_id Folder id.
	 * @return array<string, mixed>|null
	 */
	private function get_media_folder_snapshot( $folder_id ) {
		$term = get_term( $folder_id, 'media-folder' );

		if ( ! $term || is_wp_error( $term ) ) {
			return null;
		}

		$locked_raw   = get_term_meta( $term->term_id, 'locked', true );
		$bookmark_raw = get_term_meta( $term->term_id, 'bookmark', true );
		$locked       = ( '1' === $locked_raw || 1 === $locked_raw || true === $locked_raw || 'true' === $locked_raw );
		$bookmark     = ( '1' === $bookmark_raw || 1 === $bookmark_raw || true === $bookmark_raw || 'true' === $bookmark_raw );

		return array(
			'id'              => (int) $term->term_id,
			'name'            => (string) $term->name,
			'parent'          => (int) $term->parent,
			'meta'            => array(
				'locked'   => $locked,
				'bookmark' => $bookmark,
			),
			'attachmentCount' => (int) Media_Folder_Utils::get_instance()->get_attachment_count( $term->term_id, false, null ),
		);
	}

	/**
	 * Build a normalized attachment metadata payload.
	 *
	 * @param int $attachment_id Attachment id.
	 * @return array<string, mixed>|null
	 */
	private function get_attachment_metadata_snapshot( $attachment_id ) {
		$attachment = get_post( $attachment_id );

		if ( ! $attachment || 'attachment' !== $attachment->post_type ) {
			return null;
		}

		return array(
			'attachment_id' => (int) $attachment->ID,
			'title'         => (string) $attachment->post_title,
			'caption'       => (string) $attachment->post_excerpt,
			'description'   => (string) $attachment->post_content,
			'alt_text'      => (string) get_post_meta( $attachment->ID, '_wp_attachment_image_alt', true ),
			'slug'          => (string) $attachment->post_name,
			'source_url'    => (string) wp_get_attachment_url( $attachment->ID ),
			'mime_type'     => (string) get_post_mime_type( $attachment->ID ),
		);
	}

	/**
	 * Dispatch an input payload through the transcoding REST controller.
	 *
	 * @param string               $method Transcoding controller method.
	 * @param array<string, mixed> $params Request params.
	 * @param string               $http_method HTTP method.
	 * @return array<string, mixed>|WP_Error
	 */
	private function dispatch_transcoding_callback( $method, array $params, $http_method = 'GET' ) {
		$controller = Transcoding::get_instance();
		$request    = new WP_REST_Request( $http_method );

		foreach ( $params as $key => $value ) {
			$request->set_param( $key, $value );
		}

		$response = $controller->{$method}( $request );

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		if ( $response instanceof WP_REST_Response ) {
			return $response->get_data();
		}

		return is_array( $response ) ? $response : array();
	}

	/**
	 * Build a normalized source status record.
	 *
	 * @param bool        $ok Whether the source is healthy.
	 * @param int         $status_code HTTP-like status code.
	 * @param string|null $error Error message.
	 * @return array<string, mixed>
	 */
	private function build_source_status( $ok = true, $status_code = 200, $error = null ) {
		return array(
			'ok'          => (bool) $ok,
			'status_code' => (int) $status_code,
			'error'       => null === $error ? null : (string) $error,
		);
	}

	/**
	 * Build a Node MCP style bridge envelope.
	 *
	 * @param array<string, mixed> $data Data payload.
	 * @param string               $summary Summary string.
	 * @param array<string, mixed> $source_status Source status map.
	 * @param array<int, mixed>    $errors Errors list.
	 * @param bool                 $success Whether the operation succeeded.
	 * @return array<string, mixed>
	 */
}
