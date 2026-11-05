<?php
/**
 * Abilities for a video's own player settings.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Abilities;

defined( 'ABSPATH' ) || exit;

/**
 * Class Video_Settings_Abilities
 *
 * A curated set of the per-video settings in the media editor's Player
 * Settings tab: where the video's ads come from, and its thumbnail. The ad
 * source lives in `rtgodam_meta['videoConfig']`, written through the
 * attachment's REST field; thumbnails go through the same media-library
 * routes the editor's thumbnail picker uses.
 *
 * @since 2.8.0
 */
class Video_Settings_Abilities extends Ability_Group {

	/**
	 * Registers this group's abilities.
	 *
	 * @since 2.8.0
	 *
	 * @return void
	 */
	public function register() {
		$this->add(
			'godam/get-video-settings',
			array(
				'label'               => __( 'Get video settings', 'godam' ),
				'description'         => __( 'A video\'s ad source and thumbnail: whether its ads come from its ad layers or from an ad server tag, the selected thumbnail, and the thumbnails it can switch to.', 'godam' ),
				'category'            => 'godam-player',
				'input_schema'        => $this->media_id_input(),
				'output_schema'       => $this->settings_schema(),
				'execute_callback'    => array( $this, 'get_video_settings' ),
				'permission_callback' => array( $this, 'can_edit_media' ),
			)
		);

		$this->add(
			'godam/update-video-settings',
			array(
				'label'               => __( 'Update video settings', 'godam' ),
				'description'         => __( 'Change a video\'s ad source or thumbnail. ad_tag_url makes the video play ads from that VAST ad server tag instead of its ad layers; an empty string switches back to ad layers. thumbnail_url picks one of the thumbnails godam/get-video-settings lists; thumbnail_image_id uses an image from the library instead (up to 3 custom thumbnails per video). Only the settings given are changed.', 'godam' ),
				'category'            => 'godam-player',
				'input_schema'        => array(
					'type'       => 'object',
					'properties' => array(
						'id'                 => array(
							'type'        => 'integer',
							'minimum'     => 1,
							'description' => __( 'Media (attachment) ID of the video.', 'godam' ),
						),
						'ad_tag_url'         => array(
							'type'        => 'string',
							'description' => __( 'VAST ad tag URL from an ad server, or an empty string to use the video\'s ad layers again.', 'godam' ),
						),
						'thumbnail_url'      => array(
							'type'        => 'string',
							'format'      => 'uri',
							'description' => __( 'One of the thumbnails listed by godam/get-video-settings.', 'godam' ),
						),
						'thumbnail_image_id' => array(
							'type'        => 'integer',
							'minimum'     => 1,
							'description' => __( 'Image media ID to use as a custom thumbnail.', 'godam' ),
						),
					),
					'required'   => array( 'id' ),
				),
				'output_schema'       => $this->settings_schema(),
				'execute_callback'    => array( $this, 'update_video_settings' ),
				'permission_callback' => array( $this, 'can_edit_media' ),
				'meta'                => array(
					'annotations' => array( 'idempotent' => true ),
				),
			),
			true
		);
	}

	/**
	 * JSON Schema for the settings both abilities return.
	 *
	 * @since 2.8.0
	 *
	 * @return array
	 */
	private function settings_schema() {
		return array(
			'type'       => 'object',
			'properties' => array(
				'media_id'  => array( 'type' => 'integer' ),
				'ads'       => array(
					'type'       => 'object',
					'properties' => array(
						'source'      => array(
							'type' => 'string',
							'enum' => array( 'ad_layers', 'ad_server' ),
						),
						'ad_tag_url'  => array( 'type' => array( 'string', 'null' ) ),
						'ad_layers'   => array( 'type' => 'integer' ),
						'description' => array( 'type' => 'string' ),
					),
				),
				'thumbnail' => array(
					'type'       => 'object',
					'properties' => array(
						'selected'  => array( 'type' => array( 'string', 'null' ) ),
						'generated' => array(
							'type'  => 'array',
							'items' => array( 'type' => 'string' ),
						),
						'custom'    => array(
							'type'  => 'array',
							'items' => array( 'type' => 'string' ),
						),
					),
				),
			),
		);
	}

	/**
	 * Executes godam/get-video-settings.
	 *
	 * @since 2.8.0
	 *
	 * @param array $input Ability input.
	 *
	 * @return array|\WP_Error
	 */
	public function get_video_settings( $input = array() ) {
		$post = $this->get_video( $input['id'] ?? 0 );

		if ( is_wp_error( $post ) ) {
			return $post;
		}

		return $this->describe( $post->ID );
	}

	/**
	 * Executes godam/update-video-settings.
	 *
	 * @since 2.8.0
	 *
	 * @param array $input Ability input.
	 *
	 * @return array|\WP_Error
	 */
	public function update_video_settings( $input = array() ) {
		$post = $this->get_video( $input['id'] ?? 0 );

		if ( is_wp_error( $post ) ) {
			return $post;
		}

		if ( ! isset( $input['ad_tag_url'] ) && empty( $input['thumbnail_url'] ) && empty( $input['thumbnail_image_id'] ) ) {
			return new \WP_Error( 'rtgodam_nothing_to_update', __( 'Give at least one of ad_tag_url, thumbnail_url or thumbnail_image_id.', 'godam' ), array( 'status' => 400 ) );
		}

		if ( ! empty( $input['thumbnail_url'] ) && ! empty( $input['thumbnail_image_id'] ) ) {
			return new \WP_Error( 'rtgodam_two_thumbnails', __( 'Give thumbnail_url or thumbnail_image_id, not both.', 'godam' ), array( 'status' => 400 ) );
		}

		if ( isset( $input['ad_tag_url'] ) ) {
			$saved = $this->set_ad_source( $post->ID, (string) $input['ad_tag_url'] );

			if ( is_wp_error( $saved ) ) {
				return $saved;
			}
		}

		if ( ! empty( $input['thumbnail_url'] ) ) {
			$saved = $this->select_thumbnail( $post->ID, (string) $input['thumbnail_url'] );
		} elseif ( ! empty( $input['thumbnail_image_id'] ) ) {
			$saved = $this->add_custom_thumbnail( $post->ID, absint( $input['thumbnail_image_id'] ) );
		}

		if ( isset( $saved ) && is_wp_error( $saved ) ) {
			return $saved;
		}

		return $this->describe( $post->ID );
	}

	/**
	 * Switches the video between its ad layers and an ad server's tag, as the
	 * editor's "Use ad server's ad" toggle does. Switching back keeps the tag,
	 * as the editor does, so it is there if the toggle is turned on again.
	 *
	 * @since 2.8.0
	 *
	 * @param int    $attachment_id Video attachment ID.
	 * @param string $ad_tag_url    Ad tag URL, or an empty string for ad layers.
	 *
	 * @return true|\WP_Error
	 */
	private function set_ad_source( $attachment_id, $ad_tag_url ) {
		$meta   = $this->godam_meta( $attachment_id );
		$config = ( isset( $meta['videoConfig'] ) && is_array( $meta['videoConfig'] ) ) ? $meta['videoConfig'] : array();

		if ( '' === trim( $ad_tag_url ) ) {
			$config['adServer'] = 'self-hosted';
		} else {
			$url = esc_url_raw( trim( $ad_tag_url ), array( 'http', 'https' ) );

			if ( '' === $url ) {
				return new \WP_Error( 'rtgodam_invalid_ad_tag_url', __( 'ad_tag_url must be an http or https URL, or an empty string.', 'godam' ), array( 'status' => 400 ) );
			}

			$config['adServer'] = 'ad-server';
			$config['adTagURL'] = $url;
		}

		$meta['videoConfig'] = $config;

		return $this->save_godam_meta( $attachment_id, $meta );
	}

	/**
	 * Selects one of the video's thumbnails through the editor's route.
	 *
	 * The route takes any URL; the editor only ever offers the video's own
	 * thumbnails, so this does the same.
	 *
	 * @since 2.8.0
	 *
	 * @param int    $attachment_id Video attachment ID.
	 * @param string $url           Thumbnail URL.
	 *
	 * @return true|\WP_Error
	 */
	private function select_thumbnail( $attachment_id, $url ) {
		$thumbnails = $this->thumbnails( $attachment_id );

		if ( is_wp_error( $thumbnails ) ) {
			return $thumbnails;
		}

		if ( ! in_array( $url, array_merge( $thumbnails['generated'], $thumbnails['custom'] ), true ) ) {
			return new \WP_Error(
				'rtgodam_unknown_thumbnail',
				__( 'thumbnail_url is not one of this video\'s thumbnails. Pick one from godam/get-video-settings, or use thumbnail_image_id to add an image as a thumbnail.', 'godam' ),
				array( 'status' => 400 )
			);
		}

		$result = $this->rest(
			'POST',
			'/godam/v1/media-library/set-video-thumbnail',
			array(
				'attachment_id' => $attachment_id,
				'thumbnail_url' => $url,
			)
		);

		return is_wp_error( $result ) ? $result : true;
	}

	/**
	 * Adds a library image as a custom thumbnail and selects it, as the
	 * editor's "Upload" button does after an image is picked.
	 *
	 * @since 2.8.0
	 *
	 * @param int $attachment_id Video attachment ID.
	 * @param int $image_id      Image attachment ID.
	 *
	 * @return true|\WP_Error
	 */
	private function add_custom_thumbnail( $attachment_id, $image_id ) {
		if ( ! wp_attachment_is_image( $image_id ) ) {
			return new \WP_Error( 'rtgodam_thumbnail_not_image', __( 'thumbnail_image_id is not an image in the media library.', 'godam' ), array( 'status' => 400 ) );
		}

		$result = $this->rest(
			'POST',
			'/godam/v1/media-library/upload-custom-video-thumbnail',
			array(
				'attachment_id' => $attachment_id,
				'thumbnail_url' => $this->attachment_url( $image_id ),
			)
		);

		return is_wp_error( $result ) ? $result : true;
	}

	/**
	 * The video's thumbnails, read through the editor's route.
	 *
	 * The route answers "no thumbnails" with a 204 status, which is not an
	 * error status, so that answer is recognised here.
	 *
	 * @since 2.8.0
	 *
	 * @param int $attachment_id Video attachment ID.
	 *
	 * @return array{selected: string|null, generated: string[], custom: string[]}|\WP_Error
	 */
	private function thumbnails( $attachment_id ) {
		$result = $this->rest( 'GET', '/godam/v1/media-library/get-video-thumbnail', array( 'attachment_id' => $attachment_id ) );

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		$data = ( is_array( $result ) && ! empty( $result['success'] ) && is_array( $result['data'] ?? null ) ) ? $result['data'] : array();

		return array(
			'selected'  => ! empty( $data['selected'] ) ? (string) $data['selected'] : $this->meta_or_null( $attachment_id, 'rtgodam_media_video_thumbnail' ),
			'generated' => array_values( array_map( 'strval', (array) ( $data['thumbnails'] ?? array() ) ) ),
			'custom'    => array_values( array_map( 'strval', (array) ( $data['customThumbnails'] ?? array() ) ) ),
		);
	}

	/**
	 * The settings as both abilities return them.
	 *
	 * @since 2.8.0
	 *
	 * @param int $attachment_id Video attachment ID.
	 *
	 * @return array|\WP_Error
	 */
	private function describe( $attachment_id ) {
		$thumbnails = $this->thumbnails( $attachment_id );

		if ( is_wp_error( $thumbnails ) ) {
			return $thumbnails;
		}

		$meta      = $this->godam_meta( $attachment_id );
		$config    = ( isset( $meta['videoConfig'] ) && is_array( $meta['videoConfig'] ) ) ? $meta['videoConfig'] : array();
		$ad_server = 'ad-server' === ( $config['adServer'] ?? 'self-hosted' );
		$ad_layers = 0;

		foreach ( (array) ( $meta['layers'] ?? array() ) as $layer ) {
			if ( 'ad' === ( $layer['type'] ?? '' ) ) {
				++$ad_layers;
			}
		}

		return array(
			'media_id'  => $attachment_id,
			'ads'       => array(
				'source'      => $ad_server ? 'ad_server' : 'ad_layers',
				'ad_tag_url'  => ! empty( $config['adTagURL'] ) ? (string) $config['adTagURL'] : null,
				'ad_layers'   => $ad_layers,
				'description' => $ad_server
					? __( 'The player requests ads from ad_tag_url; the video\'s ad layers are turned off.', 'godam' )
					: __( 'The player shows the video\'s ad layers, if it has any.', 'godam' ),
			),
			'thumbnail' => $thumbnails,
		);
	}

	/**
	 * Returns the attachment if it is a video.
	 *
	 * @since 2.8.0
	 *
	 * @param int $attachment_id Attachment ID.
	 *
	 * @return \WP_Post|\WP_Error
	 */
	private function get_video( $attachment_id ) {
		$post = $this->get_attachment( $attachment_id );

		if ( is_wp_error( $post ) ) {
			return $post;
		}

		if ( 'video' !== $this->media_type( $this->attachment_mime_type( $post ) ) ) {
			return new \WP_Error( 'rtgodam_not_a_video', __( 'These settings are for videos only.', 'godam' ), array( 'status' => 400 ) );
		}

		return $post;
	}
}
