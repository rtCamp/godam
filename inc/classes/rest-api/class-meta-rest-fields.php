<?php
/**
 * Register REST API endpoints for meta fields.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;


/**
 * Modify Rest fields.
 */
class Meta_Rest_Fields {

	use Singleton;

	/**
	 * Construct method.
	 */
	final protected function __construct() {
		add_action( 'rest_api_init', array( $this, 'add_meta_rest_fields' ), 10, 3 );
	}

	/**
	 * Modify the response to include the 'post-related-posts' field.
	 *
	 * @return void
	 */
	public function add_meta_rest_fields() {
		register_rest_field(
			'attachment',
			'rtgodam_meta',
			array(
				'get_callback'    => function ( $post ) {
					/**
					 * Fires before reading/mutating this attachment's meta,
					 * so integrations that centralize media on another site
					 * can switch context first. These get/update callbacks
					 * fire whenever WP core's own REST machinery serves or
					 * updates this attachment field — including from routes
					 * other than /wp/v2/media (e.g. `_embed` on another
					 * route) — self-wrapped so it's correct regardless of
					 * which route triggered it.
					 *
					 * @since 2.2.0
					 */
					do_action( 'rtgodam_before_attachment_lookup' );
					$value = get_post_meta( $post['id'], 'rtgodam_meta', true );
					do_action( 'rtgodam_after_attachment_lookup' );
					return $value;
				},
				'update_callback' => function ( $value, $post ) {
					do_action( 'rtgodam_before_attachment_lookup' );
					$result = update_post_meta( $post->ID, 'rtgodam_meta', $value );
					do_action( 'rtgodam_after_attachment_lookup' );
					return $result;
				},
			)
		);

		register_rest_field(
			'attachment',
			'rtgodam_analytics',
			array(
				'get_callback'    => function ( $post ) {
					do_action( 'rtgodam_before_attachment_lookup' );
					$value = get_post_meta( $post['id'], 'rtgodam_analytics', true );
					do_action( 'rtgodam_after_attachment_lookup' );
					return $value;
				},
				'update_callback' => function ( $value, $post ) {
					do_action( 'rtgodam_before_attachment_lookup' );
					$result = update_post_meta( $post->ID, 'rtgodam_analytics', $value );
					do_action( 'rtgodam_after_attachment_lookup' );
					return $result;
				},
			)
		);

		register_post_meta(
			'attachment',
			'rtgodam_media_video_thumbnail',
			array(
				'type'          => 'string',
				'single'        => true,
				'show_in_rest'  => true,
				'auth_callback' => function () {
					return current_user_can( 'edit_posts' );
				},
			)
		);

		register_post_meta(
			'attachment',
			'rtgodam_transcoding_job_id',
			array(
				'type'          => 'string',
				'single'        => true,
				'show_in_rest'  => true,
				'auth_callback' => function () {
					return current_user_can( 'edit_posts' );
				},
			)
		);

		register_post_meta(
			'attachment',
			'rtgodam_media_pdf_thumbnail',
			array(
				'type'          => 'string',
				'single'        => true,
				'show_in_rest'  => true,
				'auth_callback' => function () {
					return current_user_can( 'edit_posts' );
				},
			)
		);

		/*
		 * The preview PDF GoDAM Central renders for a document. For a PDF upload this is
		 * the CDN copy of the file itself; for Word/Excel/PowerPoint/OpenDocument/text it
		 * is the converted preview. Exposed to REST so the Document block's editor canvas
		 * can render the same PDF the front end will.
		 */
		register_post_meta(
			'attachment',
			'rtgodam_preview_pdf_url',
			array(
				'type'          => 'string',
				'single'        => true,
				'show_in_rest'  => true,
				'auth_callback' => function () {
					return current_user_can( 'edit_posts' );
				},
			)
		);

		/*
		 * Transcoding state. Both keys have been written for a long time but were never
		 * exposed to REST, which left blocks unable to tell "still transcoding" from
		 * "failed" from "finished, but there is deliberately no preview" (a password
		 * protected document). The Document block needs that distinction to pick between
		 * its progress placeholder and its download-only panel.
		 */
		register_post_meta(
			'attachment',
			'rtgodam_transcoding_status',
			array(
				'type'          => 'string',
				'single'        => true,
				'show_in_rest'  => true,
				'auth_callback' => function () {
					return current_user_can( 'edit_posts' );
				},
			)
		);

		register_post_meta(
			'attachment',
			'rtgodam_transcoding_error_code',
			array(
				'type'          => 'string',
				'single'        => true,
				'show_in_rest'  => true,
				'auth_callback' => function () {
					return current_user_can( 'edit_posts' );
				},
			)
		);

		register_post_meta(
			'attachment',
			'rtgodam_media_audio_thumbnail',
			array(
				'type'          => 'string',
				'single'        => true,
				'show_in_rest'  => true,
				'auth_callback' => function () {
					return current_user_can( 'edit_posts' );
				},
			)
		);

		register_post_meta(
			'attachment',
			'rtgodam_hls_transcoded_url',
			array(
				'type'          => 'string',
				'single'        => true,
				'show_in_rest'  => true,
				'auth_callback' => function () {
					return current_user_can( 'edit_posts' );
				},
				'get_callback'  => function ( $post ) {
					do_action( 'rtgodam_before_attachment_lookup' );
					$value = rtgodam_get_hls_transcoded_url_from_attachment( $post->ID );
					do_action( 'rtgodam_after_attachment_lookup' );
					return $value;
				},
			)
		);
	}
}
