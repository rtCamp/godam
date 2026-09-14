<?php
/**
 * MCP abilities partial: Abilities_Upload.
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
 * Abilities_Upload trait.
 */
trait Abilities_Upload {

	/**
	 * Resolve a local upload path from a raw path or file URL.
	 *
	 * @param string $value Path or file URL.
	 * @return string
	 */
	private function resolve_upload_path( $value ) {
		$value = trim( (string) $value );
		if ( 0 === strpos( $value, 'file://' ) ) {
			$parsed_path = wp_parse_url( $value, PHP_URL_PATH );
			return rawurldecode( (string) $parsed_path );
		}

		return $value;
	}

	/**
	 * Check that a resolved filesystem path is within the WordPress uploads directory.
	 *
	 * @param string $path Resolved filesystem path.
	 * @return bool
	 */
	private function is_path_within_uploads_dir( $path ) {
		$upload_dir   = wp_get_upload_dir();
		$uploads_base = realpath( $upload_dir['basedir'] );
		$real_path    = realpath( $path );

		if ( false === $uploads_base || false === $real_path ) {
			return false;
		}

		// Ensure the resolved real path starts with the uploads base dir (with trailing sep to prevent prefix attacks).
		$base_with_sep = rtrim( $uploads_base, DIRECTORY_SEPARATOR ) . DIRECTORY_SEPARATOR;
		return ( 0 === strpos( $real_path . DIRECTORY_SEPARATOR, $base_with_sep ) );
	}

	/**
	 * Prepare a local upload source.
	 *
	 * @param string $path Filesystem path.
	 * @param string $upload_mode Upload mode.
	 * @param string $requested_source Original source string.
	 * @return array<string, mixed>|WP_Error
	 */
	private function prepare_local_upload_source( $path, $upload_mode, $requested_source ) {
		// Reject paths outside the WordPress uploads directory to prevent arbitrary file disclosure.
		if ( ! $this->is_path_within_uploads_dir( $path ) ) {
			return new WP_Error( 'godam_mcp_upload_path_rejected', __( 'The localFilePath or attachmentUri must point to a file within the WordPress uploads directory.', 'godam' ), array( 'status' => 400 ) );
		}

		if ( ! file_exists( $path ) || ! is_readable( $path ) ) {
			/* translators: %s: Requested upload source path. */
			return new WP_Error( 'godam_mcp_missing_local_file', sprintf( __( 'Upload source %s is not readable.', 'godam' ), $requested_source ), array( 'status' => 400 ) );
		}

		$filename = wp_basename( $path );
		$tmp_name = wp_tempnam( $filename );
		if ( ! $tmp_name ) {
			return new WP_Error( 'godam_mcp_temp_file_failed', __( 'Unable to create a temporary file for upload.', 'godam' ), array( 'status' => 500 ) );
		}

		if ( ! copy( $path, $tmp_name ) ) {
			wp_delete_file( $tmp_name );
			return new WP_Error( 'godam_mcp_copy_upload_failed', __( 'Unable to copy the local upload source.', 'godam' ), array( 'status' => 500 ) );
		}

		$size_bytes = (int) filesize( $tmp_name );
		if ( $size_bytes <= 0 ) {
			wp_delete_file( $tmp_name );
			/* translators: %s: Local upload source path. */
			return new WP_Error( 'godam_mcp_empty_upload_source', sprintf( __( 'Local file %s is empty.', 'godam' ), $path ), array( 'status' => 400 ) );
		}

		$mime_type = $this->resolve_video_mime_type_exact( $this->get_mime_type_from_filename_exact( $filename ), $filename );
		if ( is_wp_error( $mime_type ) ) {
			wp_delete_file( $tmp_name );
			return $mime_type;
		}

		return array(
			'tmp_name'         => $tmp_name,
			'cleanup'          => true,
			'filename'         => $filename,
			'mime_type'        => $mime_type,
			'size_bytes'       => $size_bytes,
			'upload_mode'      => $upload_mode,
			'requested_source' => $requested_source,
		);
	}

	/**
	 * Guard against SSRF by rejecting private/loopback/reserved IP destinations.
	 *
	 * @param string $url URL to validate.
	 * @return bool True when the URL is safe for an outbound server-side request.
	 */
	private function is_safe_remote_url( $url ) {
		$url = (string) $url;

		// Must be http or https.
		$scheme = strtolower( (string) wp_parse_url( $url, PHP_URL_SCHEME ) );
		if ( ! in_array( $scheme, array( 'http', 'https' ), true ) ) {
			return false;
		}

		$host = strtolower( (string) wp_parse_url( $url, PHP_URL_HOST ) );
		if ( '' === $host ) {
			return false;
		}

		// Reject bare localhost and common loopback names.
		if ( in_array( $host, array( 'localhost', 'ip6-localhost', 'ip6-loopback', '::1', '0:0:0:0:0:0:0:1' ), true ) ) {
			return false;
		}

		// Reject IPv6 loopback written as [::1].
		$raw_ipv6 = trim( $host, '[]' );
		if ( filter_var( $raw_ipv6, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6 ) && in_array( $raw_ipv6, array( '::1', '0:0:0:0:0:0:0:1' ), true ) ) {
			return false;
		}

		// Resolve hostname to IP for further checks.
		$ip = filter_var( $host, FILTER_VALIDATE_IP ) ? $host : gethostbyname( $host );

		// Reject if the resolved IP falls in any private/loopback/link-local/reserved range.
		if ( filter_var( $ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE ) === false ) {
			return false;
		}

		// Explicitly block well-known cloud metadata endpoints even if filter_var misses them.
		$blocked_prefixes = array(
			'169.254.',     // AWS / GCP / Azure link-local metadata.
			'100.64.',      // RFC 6598 carrier-grade NAT.
			'192.0.0.',     // RFC 6890 IANA special-purpose.
			'192.0.2.',     // TEST-NET-1.
			'198.51.100.',  // TEST-NET-2.
			'203.0.113.',   // TEST-NET-3.
		);
		foreach ( $blocked_prefixes as $prefix ) {
			if ( 0 === strpos( $ip, $prefix ) ) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Prepare a remote upload source.
	 *
	 * @param string $remote_url Remote url.
	 * @return array<string, mixed>|WP_Error
	 */
	private function prepare_remote_upload_source( $remote_url ) {
		require_once ABSPATH . 'wp-admin/includes/file.php';

		if ( ! $this->is_safe_remote_url( $remote_url ) ) {
			return new WP_Error( 'godam_mcp_ssrf_blocked', __( 'The remoteUrl must be a publicly routable https/http URL. Private, loopback, link-local, and reserved addresses are not permitted.', 'godam' ), array( 'status' => 400 ) );
		}

		$head_response = wp_remote_head( $remote_url, array( 'timeout' => 3 ) );
		$header_mime   = is_wp_error( $head_response ) ? '' : (string) wp_remote_retrieve_header( $head_response, 'content-type' );
		$header_mime   = trim( strtok( $header_mime, ';' ) );
		$filename      = $this->get_filename_from_url_exact( $remote_url, '' !== $header_mime ? $header_mime : 'video/mp4' );
		$mime_type     = $this->resolve_video_mime_type_exact( '' !== $header_mime ? $header_mime : $this->get_mime_type_from_filename_exact( $filename ), $filename );
		if ( is_wp_error( $mime_type ) ) {
			return $mime_type;
		}

		$tmp_name = download_url( $remote_url, 300 );
		if ( is_wp_error( $tmp_name ) ) {
			/* translators: %s: Remote download error message. */
			return new WP_Error( 'godam_mcp_remote_download_failed', sprintf( __( 'Remote video download failed: %s', 'godam' ), $tmp_name->get_error_message() ), array( 'status' => 400 ) );
		}

		$size_bytes = (int) filesize( $tmp_name );
		if ( $size_bytes <= 0 ) {
			wp_delete_file( $tmp_name );
			return new WP_Error( 'godam_mcp_empty_upload_source', __( 'Remote video download returned an empty body.', 'godam' ), array( 'status' => 400 ) );
		}

		return array(
			'tmp_name'         => $tmp_name,
			'cleanup'          => true,
			'filename'         => $filename,
			'mime_type'        => $mime_type,
			'size_bytes'       => $size_bytes,
			'upload_mode'      => 'remote_url',
			'requested_source' => $remote_url,
		);
	}

	/**
	 * Upload a prepared source to WordPress media and return the exact Node MCP payload.
	 *
	 * @param array<string, mixed> $source Prepared source.
	 * @param string               $title Requested title.
	 * @return array<string, mixed>|WP_Error
	 */
	private function upload_video_source_to_wordpress( array $source, $title ) {
		require_once ABSPATH . 'wp-admin/includes/file.php';
		require_once ABSPATH . 'wp-admin/includes/media.php';
		require_once ABSPATH . 'wp-admin/includes/image.php';

		$file_array = array(
			'name'     => (string) $source['filename'],
			'type'     => (string) $source['mime_type'],
			'tmp_name' => (string) $source['tmp_name'],
			'error'    => 0,
			'size'     => (int) $source['size_bytes'],
		);

		$attachment_id = media_handle_sideload(
			$file_array,
			0,
			null,
			array(
				'post_mime_type' => (string) $source['mime_type'],
			)
		);

		if ( is_wp_error( $attachment_id ) ) {
			return new WP_Error( 'godam_mcp_upload_failed', $attachment_id->get_error_message(), array( 'status' => 500 ) );
		}

		if ( '' !== trim( (string) $title ) ) {
			wp_update_post(
				array(
					'ID'         => $attachment_id,
					'post_title' => sanitize_text_field( wp_unslash( $title ) ),
				)
			);
		}

		$raw_attachment = $this->get_attachment_rest_payload( $attachment_id );
		if ( is_wp_error( $raw_attachment ) ) {
			return $raw_attachment;
		}

		return array(
			'attachment_id'    => (int) $attachment_id,
			'source_url'       => (string) ( $raw_attachment['source_url'] ?? ( $raw_attachment['guid']['rendered'] ?? '' ) ),
			'mime_type'        => (string) ( $raw_attachment['mime_type'] ?? $source['mime_type'] ),
			'media_type'       => (string) ( $raw_attachment['media_type'] ?? 'video' ),
			'title'            => '' !== trim( (string) $title ) ? trim( (string) $title ) : (string) ( $raw_attachment['title']['rendered'] ?? $this->get_display_title_from_filename_exact( (string) $source['filename'] ) ),
			'filename'         => (string) $source['filename'],
			'size_bytes'       => (int) $source['size_bytes'],
			'upload_mode'      => (string) $source['upload_mode'],
			'requested_source' => (string) $source['requested_source'],
			'raw_attachment'   => $raw_attachment,
		);
	}

	/**
	 * Cleanup a prepared upload source.
	 *
	 * @param array<string, mixed> $source Prepared source.
	 * @return void
	 */
	private function cleanup_upload_source( array $source ) {
		if ( ! empty( $source['cleanup'] ) && ! empty( $source['tmp_name'] ) && file_exists( (string) $source['tmp_name'] ) ) {
			wp_delete_file( (string) $source['tmp_name'] );
		}
	}

	/**
	 * Get a safe filename from a URL.
	 *
	 * @param string $source_url Source URL.
	 * @param string $mime_type Mime type.
	 * @return string
	 */
	private function get_filename_from_url_exact( $source_url, $mime_type ) {
		$path         = wp_parse_url( $source_url, PHP_URL_PATH );
		$raw_filename = $path ? wp_basename( $path ) : 'thumbnail';
		$decoded      = rawurldecode( (string) $raw_filename );
		$trimmed      = '' !== trim( $decoded ) ? trim( $decoded ) : 'thumbnail';
		$has_ext      = (bool) preg_match( '/\.[a-z0-9]{2,5}$/i', $trimmed );
		$base         = $this->sanitize_upload_filename_exact( preg_replace( '/\.[a-z0-9]{2,5}$/i', '', $trimmed ) );

		if ( $has_ext ) {
			return $this->sanitize_upload_filename_exact( $trimmed );
		}

		return $base . '.' . $this->get_extension_from_mime_type_exact( $mime_type );
	}

	/**
	 * Sanitize an upload filename.
	 *
	 * @param string $value Raw filename.
	 * @return string
	 */
	private function sanitize_upload_filename_exact( $value ) {
		return preg_replace( '/-+/', '-', preg_replace( '/[^a-zA-Z0-9._-]+/', '-', (string) $value ) );
	}

	/**
	 * Get a file extension from mime type.
	 *
	 * @param string $mime_type Mime type.
	 * @return string
	 */
	private function get_extension_from_mime_type_exact( $mime_type ) {
		$mime_type = strtolower( (string) $mime_type );
		$map       = array(
			'video/mp4'        => 'mp4',
			'video/quicktime'  => 'mov',
			'video/webm'       => 'webm',
			'video/ogg'        => 'ogv',
			'video/x-msvideo'  => 'avi',
			'video/x-ms-wmv'   => 'wmv',
			'video/x-flv'      => 'flv',
			'video/mpeg'       => 'mpeg',
			'video/x-m4v'      => 'm4v',
			'video/x-matroska' => 'mkv',
			'video/3gpp'       => '3gp',
			'application/mxf'  => 'mxf',
		);

		return isset( $map[ $mime_type ] ) ? $map[ $mime_type ] : 'mp4';
	}

	/**
	 * Get mime type from filename.
	 *
	 * @param string $filename Filename.
	 * @return string
	 */
	private function get_mime_type_from_filename_exact( $filename ) {
		$type = wp_check_filetype( $filename );
		return isset( $type['type'] ) ? (string) $type['type'] : '';
	}

	/**
	 * Resolve a valid video mime type.
	 *
	 * @param string $mime_type Mime type.
	 * @param string $filename Filename.
	 * @return string|WP_Error
	 */
	private function resolve_video_mime_type_exact( $mime_type, $filename ) {
		$mime_type = strtolower( (string) $mime_type );
		if ( 0 === strpos( $mime_type, 'video/' ) ) {
			return $mime_type;
		}

		$inferred = $this->get_mime_type_from_filename_exact( $filename );
		if ( in_array( $mime_type, array( '', 'application/octet-stream', 'binary/octet-stream' ), true ) && 0 === strpos( $inferred, 'video/' ) ) {
			return $inferred;
		}

		/* translators: 1: MIME type, 2: filename. */
		return new WP_Error( 'godam_mcp_invalid_video_mime', sprintf( __( 'Only video uploads are supported. Received content type "%1$s" for %2$s.', 'godam' ), '' !== $mime_type ? $mime_type : 'unknown', $filename ), array( 'status' => 400 ) );
	}

	/**
	 * Get a display title from a filename.
	 *
	 * @param string $filename Filename.
	 * @return string
	 */
	private function get_display_title_from_filename_exact( $filename ) {
		return trim( preg_replace( '/[-_]+/', ' ', preg_replace( '/\.[a-z0-9]{2,5}$/i', '', (string) $filename ) ) );
	}

	/**
	 * Search folder candidates.
	 *
	 * @param string $query Search query.
	 * @return array<int, array<string, mixed>>
	 */
}
