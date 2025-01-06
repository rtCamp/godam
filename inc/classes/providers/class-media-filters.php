<?php
/**
 * Media_Filters class.
 *
 * @package transcoder
 */

namespace Transcoder\Inc\Providers;

use Transcoder\Inc\Traits\Singleton;
use Transcoder\Inc\Providers\Handlers\Item_Handler;
use Transcoder\Inc\Providers\Exceptions\EasyDamException;
use Transcoder\Inc\Providers\Handlers\Error_Handler;

/**
 * Class Media_Filters
 */
class Media_Filters {

	use Singleton;

	/**
	 * Construct method.
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * To setup action/filter.
	 *
	 * @return void
	 */
	protected function setup_hooks() {

		/**
		 * Main Filter to upload the media from the media library.
		 */
		add_action( 'wp_update_attachment_metadata', array( $this, 'handle_media_upload' ), 10, 2 );
		add_action( 'delete_attachment', array( $this, 'delete_media' ) );
		add_filter( 'wp_get_attachment_url', array( $this, 'get_s3_url' ), 10, 2 );

		/*
		 * Media column management.
		 * 
		 * TODO: we are also using REST API to upload media items, and AJAX call to do the same, so we can merge those two calls.
		 */
		add_action( 'wp_ajax_upload_to_s3', array( $this, 'handle_upload_to_s3' ) );

		add_filter( 'handle_bulk_actions-upload', array( $this, 'handle_bulk_action_upload_to_s3' ), 10, 3 );
		add_action( 'admin_notices', array( $this, 'bulk_action_notices' ) );
	}


	/**
	 * Handle the upload to S3 request.
	 *
	 * @return void
	 */
	public function handle_upload_to_s3() {

		if ( ! current_user_can( 'upload_files' ) ) {
			wp_send_json_error( array( 'error' => __( 'Permission denied.', 'transcoder' ) ) );
		}

		check_admin_referer( 'easydam_media_library', 'nonce' );

		$post_id = isset( $_POST['post_id'] ) ? intval( $_POST['post_id'] ) : 0;

		if ( ! $post_id ) {
			wp_send_json_error( array( 'error' => __( 'Invalid Post ID.', 'transcoder' ) ) );
		}

		$this->handle_media_upload( array(), $post_id );

		$s3_url = get_post_meta( $post_id, 's3_url', true );

		if ( empty( $s3_url ) ) {
			wp_send_json_error( array( 'error' => __( 'Failed to upload to S3.', 'transcoder' ) ) );
		}

		wp_send_json_success( array( 'url' => esc_url( $s3_url ) ) );
	}

	/**
	 * Display bulk action notices.
	 *
	 * @return void
	 */
	public function bulk_action_notices() {

		check_admin_referer( 'bulk-upload-to-s3', 'nonce' );

		if ( isset( $_REQUEST['bulk_upload_to_s3'] ) ) {
			$success_count = intval( $_REQUEST['bulk_upload_to_s3'] );

			if ( $success_count > 0 ) {
				printf(
					'<div class="notice notice-success"><p>%s</p></div>',
					/* translators: %d: number of files */
					sprintf( esc_html__( '%d files successfully uploaded to S3.', 'transcoder' ), intval( $success_count ) )
				);
			}
		}

		if ( isset( $_REQUEST['bulk_upload_to_s3_error'] ) ) {
			$error_count = intval( $_REQUEST['bulk_upload_to_s3_error'] );

			if ( $error_count > 0 ) {
				printf(
					'<div class="notice notice-error"><p>%s</p></div>',
					/* translators: %d: number of files */
					sprintf( esc_html__( 'Failed to upload %d files to S3.', 'transcoder' ), intval( $error_count ) )
				);
			}
		}
	}

	/**
	 * Handle bulk action upload to S3.
	 *
	 * @param string $redirect_to Redirect URL.
	 * @param string $action      Action.
	 * @param array  $post_ids    Post IDs.
	 *
	 * @return string
	 */
	public function handle_bulk_action_upload_to_s3( $redirect_to, $action, $post_ids ) {
		if ( 'upload_to_s3' !== $action ) {
			return $redirect_to;
		}
	
		$success_count = 0;
	
		foreach ( $post_ids as $post_id ) {

			$uploaded = false;

			try {
				Item_Handler::upload_item( $post_id );
				$uploaded = true;
			} catch ( EasyDamException $e ) {
				Error_Handler::handle_exception( $e );
			}

			if ( $uploaded ) {
				$success_count++;
			}
		}
	
		// Add query args to the redirect URL for feedback.
		$redirect_to = add_query_arg(
			array(
				'bulk_upload_to_s3'       => $success_count,
				'bulk_upload_to_s3_error' => count( $post_ids ) - $success_count,
				'nonce'                   => wp_create_nonce( 'bulk-upload-to-s3' ),
			),
			$redirect_to 
		);
	
		return $redirect_to;
	}


	/**
	 * Handle media upload.
	 * 
	 * Use of the wp_update_attachment_metadata to insure that different images sizes are generated.
	 *
	 * @param array $data    Data to be saved.
	 * @param int   $post_id Post ID.
	 *
	 * @return array
	 */
	public function handle_media_upload( $data, $post_id ) {
		try {
			Item_Handler::upload_item( $post_id );
		} catch ( EasyDamException $e ) {
			Error_Handler::handle_exception( $e );
		}

		return $data;
	}

	/**|
	 * Delete the attachment media from S3 on hook delete_attachment.
	 * 
	 * @param int $post_id Post ID.
	 */
	public function delete_media( $post_id ) {
		try {
			Item_Handler::delete_item( $post_id );
		} catch ( EasyDamException $e ) {
			Error_Handler::handle_exception( $e );
		}
	}

	/**
	 * Return the S3 URL if available.
	 *
	 * @param string $url     URL of the attachment.
	 * @param int    $post_id Post ID.
	 * @return string
	 */
	public function get_s3_url( $url, $post_id ) {
		$s3_url = get_post_meta( $post_id, 's3_url', true );

		if ( ! empty( $s3_url ) ) {

			return $s3_url;
		}

		return $url;
	}
}
