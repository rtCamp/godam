<?php
/**
 * Media_Filters class.
 *
 * @package transcoder
 */

namespace Transcoder\Inc\Providers;

use Transcoder\Inc\Traits\Singleton;

use Transcoder\Inc\Providers\Handlers\Item_Handler;
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

	public function bulk_action_notices() {
		if ( isset( $_REQUEST['bulk_upload_to_s3'] ) ) {
			$success_count = intval( $_REQUEST['bulk_upload_to_s3'] );
			$error_count   = intval( $_REQUEST['bulk_upload_to_s3_error'] );
	
			if ( $success_count > 0 ) {
				printf(
					'<div class="notice notice-success"><p>%s</p></div>',
					sprintf( __( '%d files successfully uploaded to S3.', 'transcoder' ), $success_count )
				);
			}
	
			if ( $error_count > 0 ) {
				printf(
					'<div class="notice notice-error"><p>%s</p></div>',
					sprintf( __( 'Failed to upload %d files to S3.', 'transcoder' ), $error_count )
				);
			}
		}
	}

	public function handle_bulk_action_upload_to_s3( $redirect_to, $action, $post_ids ) {

		if ( 'upload_to_s3' !== $action ) {
			return $redirect_to; // Exit if not the correct bulk action
		}
	
		$success_count = 0;

		error_log( 'Bulk action upload to S3' . print_r( $post_ids, true ) );
	
		// Loop through the selected media attachments
		foreach ( $post_ids as $post_id ) {
			// Your logic to upload the attachment to S3

			try {
				$item_handler = new Item_Handler();
				$uploaded     = $item_handler->upload_item( $post_id );
			} catch ( \Exception $e ) {
				$uploaded = false;
			}

			if ( $uploaded ) {
				$success_count++;
			}
		}
	
		// Add query args to the redirect URL for feedback
		$redirect_to = add_query_arg(
			array(
				'bulk_upload_to_s3'       => $success_count,
				'bulk_upload_to_s3_error' => count( $post_ids ) - $success_count,
			),
			$redirect_to 
		);
	
		return $redirect_to;
	}


	/**
	 * Handle media upload.
	 *
	 * @param array $data    Data to be saved.
	 * @param int   $post_id Post ID.
	 *
	 * @return void
	 */
	public function handle_media_upload( $data, $post_id ) {
		$item_handler = new Item_Handler();
		$item_handler->upload_item( $post_id );

		return $data;
	}

	public function delete_media( $post_id ) {
		$item_handler = new Item_Handler();
		$item_handler->delete_item( $post_id );
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
