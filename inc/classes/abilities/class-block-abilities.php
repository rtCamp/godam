<?php
/**
 * Abilities for placing GoDAM blocks in content.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Abilities;

defined( 'ABSPATH' ) || exit;

/**
 * Class Block_Abilities
 *
 * Posts are created and updated through core's REST routes for their post
 * type, so the user's capabilities for that type — including whether they
 * may publish — are checked the same way as in the block editor.
 *
 * Each block is saved with the attributes its block editor stores when a user
 * picks that media from the library. With fewer, the editor would show an
 * empty placeholder or rewrite the block as soon as the post is opened.
 *
 * @since n.e.x.t
 */
class Block_Abilities extends Ability_Group {

	/**
	 * Post types media can be added to.
	 *
	 * @since n.e.x.t
	 *
	 * @var string[]
	 */
	const POST_TYPES = array( 'page', 'post' );

	/**
	 * The block each media type is placed with.
	 *
	 * @since n.e.x.t
	 *
	 * @var array<string, string>
	 */
	const BLOCKS = array(
		'video'    => 'godam/video',
		'audio'    => 'godam/audio',
		'image'    => 'godam/image',
		'document' => 'godam/pdf',
		'gallery'  => 'godam/gallery-v2',
	);

	/**
	 * What a video player does when it leaves the visitor's view, as the video
	 * block offers it. An empty string uses the site-wide setting.
	 *
	 * @since n.e.x.t
	 *
	 * @var string[]
	 */
	const OUT_OF_VIEW = array( '', 'off', 'autoplay', 'pause', 'mute' );

	/**
	 * Registers this group's abilities.
	 *
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	public function register() {
		$this->add(
			'godam/add-media-to-page',
			array(
				'label'               => __( 'Add media to a page', 'godam' ),
				'description'         => __( 'Add a GoDAM block for a media item to the end of an existing page or post, or create a new one with it. The block follows the media type: a video gets the GoDAM Video block (its layers and chapters show automatically), audio the GoDAM Audio block, an image the GoDAM Image block (with its hotspots), and a document the GoDAM Document block. Give media_ids instead of media_id to add a gallery of several videos. New posts are drafts unless status is publish; an existing post keeps its status unless status is given. player settings apply to videos only. Autoplay and lightbox cannot both apply: a lightbox video plays when the viewer opens it.', 'godam' ),
				'category'            => 'godam-player',
				'input_schema'        => array(
					'type'       => 'object',
					'properties' => array(
						'media_id'  => array(
							'type'        => 'integer',
							'minimum'     => 1,
							'description' => __( 'Media ID of the video, audio, image or document.', 'godam' ),
						),
						'media_ids' => array(
							'type'        => 'array',
							'items'       => array(
								'type'    => 'integer',
								'minimum' => 1,
							),
							'minItems'    => 2,
							'uniqueItems' => true,
							'description' => __( 'Media IDs of two or more videos, to add as a gallery in this order. Use instead of media_id.', 'godam' ),
						),
						'post_id'   => array(
							'type'        => 'integer',
							'minimum'     => 1,
							'description' => __( 'Existing page or post to add the media to. Omit to create a new one.', 'godam' ),
						),
						'title'     => array(
							'type'        => 'string',
							'description' => __( 'Title of the new page or post. Required when post_id is omitted.', 'godam' ),
						),
						'post_type' => array(
							'type'    => 'string',
							'enum'    => self::POST_TYPES,
							'default' => 'page',
						),
						'status'    => array(
							'type'        => 'string',
							'enum'        => array( 'draft', 'publish' ),
							'description' => __( 'Status to set. A new page or post is a draft when this is omitted. Omit it for an existing one to keep its current status.', 'godam' ),
						),
						'player'    => array(
							'type'        => 'object',
							'description' => __( 'Video player settings. Videos only.', 'godam' ),
							'properties'  => array(
								'autoplay'             => array(
									'type'        => 'boolean',
									'description' => __( 'Start playing on load. Autoplaying videos are muted.', 'godam' ),
								),
								'show_in_lightbox'     => array(
									'type'        => 'boolean',
									'description' => __( 'Show a poster that opens the video in a lightbox.', 'godam' ),
								),
								'loop'                 => array( 'type' => 'boolean' ),
								'muted'                => array( 'type' => 'boolean' ),
								'controls'             => array(
									'type'    => 'boolean',
									'default' => true,
								),
								'show_share_button'    => array( 'type' => 'boolean' ),
								'caption'              => array( 'type' => 'string' ),
								'out_of_view_behavior' => array(
									'type'        => 'string',
									'enum'        => self::OUT_OF_VIEW,
									'description' => __( 'When the player scrolls out of view: off (do nothing), autoplay (pause autoplaying videos only), pause (pause all videos) or mute (keep playing, muted). Empty or omitted uses the site setting from godam/get-site-settings.', 'godam' ),
								),
							),
						),
					),
				),
				'output_schema'       => array( 'type' => 'object' ),
				'execute_callback'    => array( $this, 'add_media_to_page' ),
				'permission_callback' => array( $this, 'can_add_media' ),
			),
			true
		);
	}

	/**
	 * Permission: the user can edit the target post, or create one of that type.
	 *
	 * Publishing is checked by the post type's REST route.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $input Ability input.
	 *
	 * @return bool
	 */
	public function can_add_media( $input = array() ) {
		if ( ! current_user_can( 'upload_files' ) ) {
			return false;
		}

		if ( ! empty( $input['post_id'] ) ) {
			return current_user_can( 'edit_post', absint( $input['post_id'] ) ); // godam-coverage-ignore -- can_add_media(): post_id is the host page or post the media is placed on, never the attachment.
		}

		$post_type = get_post_type_object( $input['post_type'] ?? 'page' );

		return $post_type && current_user_can( $post_type->cap->create_posts );
	}

	/**
	 * Executes godam/add-media-to-page.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $input Ability input.
	 *
	 * @return array|\WP_Error
	 */
	public function add_media_to_page( $input = array() ) {
		$player = (array) ( $input['player'] ?? array() );
		$block  = $this->build_block( $input, $player );

		if ( is_wp_error( $block ) ) {
			return $block;
		}

		if ( ! empty( $input['post_id'] ) ) {
			$target = get_post( absint( $input['post_id'] ) ); // godam-coverage-ignore -- add_media_to_page(): post_id is the host page or post being edited, checked below to be a page or post, not an attachment.

			if ( ! $target || ! in_array( $target->post_type, self::POST_TYPES, true ) ) {
				return new \WP_Error( 'rtgodam_post_not_found', __( 'post_id is not a page or post on this site.', 'godam' ), array( 'status' => 404 ) );
			}

			$route  = $this->posts_route( $target->post_type ) . '/' . $target->ID;
			$params = array( 'content' => rtrim( $target->post_content ) . "\n\n" . $block['markup'] );

			if ( ! empty( $input['status'] ) ) {
				$params['status'] = $input['status'];
			}
		} else {
			if ( empty( $input['title'] ) ) {
				return new \WP_Error( 'rtgodam_title_missing', __( 'Give a title for the new page, or a post_id to add the media to.', 'godam' ), array( 'status' => 400 ) );
			}

			$route  = $this->posts_route( $input['post_type'] ?? 'page' );
			$params = array(
				'title'   => sanitize_text_field( $input['title'] ),
				'status'  => $input['status'] ?? 'draft',
				'content' => $block['markup'],
			);
		}

		$saved = $this->rest( 'POST', $route, $params );

		if ( is_wp_error( $saved ) ) {
			return $saved;
		}

		$post_id = (int) $saved['id'];
		$result  = array(
			'post_id'   => $post_id,
			'title'     => $this->plain_title( get_post( $post_id ) ), // godam-coverage-ignore -- add_media_to_page(): $post_id is the host page or post the REST route just saved, not an attachment.
			'post_type' => get_post_type( $post_id ), // godam-coverage-ignore -- add_media_to_page(): same host post as above.
			'status'    => get_post_status( $post_id ),
			'url'       => 'publish' === get_post_status( $post_id ) ? get_permalink( $post_id ) : get_preview_post_link( $post_id ),
			'edit_url'  => get_edit_post_link( $post_id, 'raw' ),
			'block'     => $block['name'],
			'media_ids' => $block['media_ids'],
		);

		if ( 'godam/video' === $block['name'] ) {
			$result['player'] = array(
				'autoplay'             => ! empty( $player['autoplay'] ),
				'show_in_lightbox'     => ! empty( $player['show_in_lightbox'] ),
				'out_of_view_behavior' => rtgodam_get_out_of_view_behavior( $player['out_of_view_behavior'] ?? '' ),
			);

			if ( ! empty( $player['autoplay'] ) && ! empty( $player['show_in_lightbox'] ) ) {
				$result['note'] = __( 'Both autoplay and lightbox are saved on the block, as the editor allows. On the page the lightbox wins: the video shows as a poster and starts playing when the viewer opens it.', 'godam' );
			}
		}

		return $result;
	}

	/**
	 * Builds the block for the requested media, after checking it.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $input  Ability input.
	 * @param array $player Player settings.
	 *
	 * @return array{name: string, markup: string, media_ids: int[]}|\WP_Error
	 */
	private function build_block( array $input, array $player ) {
		$has_one  = ! empty( $input['media_id'] );
		$has_many = ! empty( $input['media_ids'] );

		if ( $has_one === $has_many ) {
			return new \WP_Error( 'rtgodam_media_choice', __( 'Give either media_id for one media item, or media_ids for a gallery of videos.', 'godam' ), array( 'status' => 400 ) );
		}

		if ( $has_many ) {
			if ( ! empty( $player ) ) {
				return new \WP_Error( 'rtgodam_player_not_for_gallery', __( 'player settings apply to a single video, not to a gallery.', 'godam' ), array( 'status' => 400 ) );
			}

			return $this->gallery_block( array_values( array_unique( array_map( 'absint', (array) $input['media_ids'] ) ) ) );
		}

		$media = $this->get_attachment( $input['media_id'] );

		if ( is_wp_error( $media ) ) {
			return $media;
		}

		$type = $this->media_type( $this->attachment_mime_type( $media ) );

		if ( 'video' !== $type && ! empty( $player ) ) {
			/* translators: %s: media type, e.g. image. */
			return new \WP_Error( 'rtgodam_player_not_for_type', sprintf( __( 'player settings apply to videos only; this media item is %s.', 'godam' ), $type ), array( 'status' => 400 ) );
		}

		switch ( $type ) {
			case 'video':
				$markup = $this->video_block( $media->ID, $player );
				break;

			case 'audio':
				$markup = $this->audio_block( $media );
				break;

			case 'image':
				$markup = $this->image_block( $media );
				break;

			default:
				$markup = $this->document_block( $media );
		}

		if ( is_wp_error( $markup ) ) {
			return $markup;
		}

		return array(
			'name'      => self::BLOCKS[ $type ],
			'markup'    => $markup,
			'media_ids' => array( $media->ID ),
		);
	}

	/**
	 * Serialised markup for a GoDAM Video block.
	 *
	 * The block renders on the server from its attributes; its saved markup is
	 * the empty wrapper its save() produces.
	 *
	 * @since n.e.x.t
	 *
	 * @param int   $media_id Video attachment ID.
	 * @param array $player   Player settings from the ability input.
	 *
	 * @return string|\WP_Error
	 */
	private function video_block( $media_id, array $player ) {
		// The block editor reads the attachment through the media route when a
		// library video is picked, and stores what it finds.
		$record = $this->rest( 'GET', '/wp/v2/media/' . $media_id, array( 'context' => 'view' ) );

		if ( is_wp_error( $record ) ) {
			return $record;
		}

		$meta    = (array) ( $record['meta'] ?? array() );
		$details = (array) ( $record['media_details'] ?? array() );
		$attrs   = array(
			'src'         => $this->attachment_url( $media_id ),
			'id'          => $media_id,
			'cmmId'       => $media_id,
			'caption'     => (string) ( $this->attachment_post( $media_id )->post_excerpt ?? '' ),
			'seo'         => array(
				'contentUrl'       => ! empty( $meta['rtgodam_hls_transcoded_url'] ) ? $meta['rtgodam_hls_transcoded_url'] : $record['source_url'],
				'headline'         => (string) ( $record['title']['rendered'] ?? '' ),
				'description'      => $this->text_content( (string) ( $record['description']['rendered'] ?? '' ) ),
				'uploadDate'       => $this->utc_iso( (string) ( $record['date_gmt'] ?? '' ) ),
				'duration'         => (string) ( $record['video_duration_iso8601'] ?? '' ),
				'thumbnailUrl'     => (string) ( $meta['rtgodam_media_video_thumbnail'] ?? '' ),
				'isFamilyFriendly' => true,
			),
			'sources'     => $this->video_sources( $media_id ),
			'videoWidth'  => ! empty( $details['width'] ) ? (string) $details['width'] : null,
			'videoHeight' => ! empty( $details['height'] ) ? (string) $details['height'] : null,
		);
		$map     = array(
			'autoplay'          => 'autoplay',
			'show_in_lightbox'  => 'showInLightbox',
			'loop'              => 'loop',
			'muted'             => 'muted',
			'controls'          => 'controls',
			'show_share_button' => 'showShareButton',
		);

		foreach ( $map as $input_key => $attribute ) {
			if ( isset( $player[ $input_key ] ) ) {
				$attrs[ $attribute ] = (bool) $player[ $input_key ];
			}
		}

		// The block editor mutes a video when autoplay is turned on; browsers only autoplay muted video.
		if ( ! empty( $attrs['autoplay'] ) ) {
			$attrs['muted'] = true;
		}

		if ( ! empty( $player['caption'] ) ) {
			$attrs['caption']     = sanitize_text_field( $player['caption'] );
			$attrs['showCaption'] = true;
		} else {
			// The editor sets "Show caption" from the video's own captions setting
			// as soon as the video is picked.
			$attrs['showCaption'] = false !== ( $record['rtgodam_meta']['videoConfig']['controlBar']['subsCapsButton'] ?? null );
		}

		if ( ! empty( $player['out_of_view_behavior'] ) ) {
			$attrs['outOfViewBehavior'] = $player['out_of_view_behavior'];
		}

		return $this->serialize( 'godam/video', $attrs, array(), array( "\n<div class=\"wp-block-godam-video\"></div>\n" ) );
	}

	/**
	 * Playback sources in the order the block editor stores them: HLS, then
	 * DASH, then the original file. A video still transcoding has only the
	 * original; the player reads the transcoded URLs from the attachment later.
	 *
	 * @since n.e.x.t
	 *
	 * @param int $media_id Video attachment ID.
	 *
	 * @return array[]
	 */
	private function video_sources( $media_id ) {
		$sources = array();
		$hls     = $this->meta_or_null( $media_id, 'rtgodam_hls_transcoded_url' );
		$dash    = $this->meta_or_null( $media_id, 'rtgodam_transcoded_url' );

		if ( $hls ) {
			$sources[] = array(
				'src'  => $hls,
				'type' => str_ends_with( $hls, '.m3u8' ) ? 'application/x-mpegURL' : $this->attachment_mime_type( $media_id ),
			);
		}

		if ( $dash ) {
			$sources[] = array(
				'src'  => $dash,
				'type' => str_ends_with( $dash, '.mpd' ) ? 'application/dash+xml' : $this->attachment_mime_type( $media_id ),
			);
		}

		$original = $this->attachment_url( $media_id );

		$sources[] = array(
			'src'  => $original,
			'type' => str_ends_with( $original, '.mov' ) ? 'video/mp4' : $this->attachment_mime_type( $media_id ),
		);

		return $sources;
	}

	/**
	 * Serialised markup for a GoDAM Audio block, with what its editor stores
	 * when a library file is picked: the file, its title and description
	 * (without the URLs WordPress sometimes seeds it with), and GoDAM's cover
	 * image when the file has one.
	 *
	 * @since n.e.x.t
	 *
	 * @param \WP_Post $media Audio attachment.
	 *
	 * @return string
	 */
	private function audio_block( \WP_Post $media ) {
		$description = trim( preg_replace( '/\s+/', ' ', preg_replace( '#https?://\S+#', '', (string) $media->post_content ) ) );
		$attrs       = array(
			'src'         => $this->attachment_url( $media->ID ),
			'id'          => $media->ID,
			'audioTitle'  => $media->post_title,
			'description' => $description,
		);
		$cover       = $this->meta_or_null( $media->ID, 'rtgodam_media_audio_thumbnail' );

		if ( $cover ) {
			$attrs['thumbnail'] = $cover;
		}

		return $this->serialize( 'godam/audio', $attrs );
	}

	/**
	 * Serialised markup for a GoDAM Image block, with what its editor stores
	 * when a library image is picked.
	 *
	 * @since n.e.x.t
	 *
	 * @param \WP_Post $media Image attachment.
	 *
	 * @return string
	 */
	private function image_block( \WP_Post $media ) {
		$metadata = $this->attachment_metadata( $media->ID );

		return $this->serialize(
			'godam/image',
			array(
				'id'     => $media->ID,
				'url'    => $this->attachment_url( $media->ID ),
				'alt'    => (string) $this->meta_or_null( $media->ID, '_wp_attachment_image_alt' ),
				'width'  => ! empty( $metadata['width'] ) ? (int) $metadata['width'] : null,
				'height' => ! empty( $metadata['height'] ) ? (int) $metadata['height'] : null,
			)
		);
	}

	/**
	 * Serialised markup for a GoDAM Document block, with what its editor
	 * stores when a library document is picked.
	 *
	 * @since n.e.x.t
	 *
	 * @param \WP_Post $media Document attachment.
	 *
	 * @return string|\WP_Error
	 */
	private function document_block( \WP_Post $media ) {
		$mime      = $this->attachment_mime_type( $media );
		$supported = function_exists( 'rtgodam_get_supported_document_types' ) ? rtgodam_get_supported_document_types() : array( 'application/pdf' => 'pdf' );
		$extension = strtolower( pathinfo( (string) wp_parse_url( (string) $this->attachment_url( $media->ID ), PHP_URL_PATH ), PATHINFO_EXTENSION ) );

		// The editor checks the MIME type; text/plain also covers files it does
		// not show (.srt, .c), so the extension must be a listed one too.
		if ( ! isset( $supported[ $mime ] ) || ! in_array( $extension, array_values( $supported ), true ) ) {
			return new \WP_Error(
				'rtgodam_unsupported_document',
				__( 'The GoDAM Document block shows PDF, Word, Excel, PowerPoint, OpenDocument, TXT and CSV files; this file is none of those.', 'godam' ),
				array( 'status' => 400 )
			);
		}

		return $this->serialize(
			'godam/pdf',
			array(
				'src'         => $this->attachment_url( $media->ID ),
				'caption'     => $media->post_excerpt,
				'id'          => $media->ID,
				'docTitle'    => $media->post_title,
				'description' => $media->post_content,
				'pageCount'   => 0,
			)
		);
	}

	/**
	 * Serialised markup for a GoDAM Gallery of hand-picked videos: the gallery
	 * block in its "Handpicked" mode with one item block per video, as the
	 * editor builds it when videos are picked.
	 *
	 * @since n.e.x.t
	 *
	 * @param int[] $media_ids Video attachment IDs, in gallery order.
	 *
	 * @return array{name: string, markup: string, media_ids: int[]}|\WP_Error
	 */
	private function gallery_block( array $media_ids ) {
		if ( count( $media_ids ) < 2 ) {
			return new \WP_Error( 'rtgodam_gallery_too_small', __( 'A gallery needs at least two different videos. Use media_id for one.', 'godam' ), array( 'status' => 400 ) );
		}

		$items = array();

		foreach ( $media_ids as $media_id ) {
			$media = $this->get_attachment( $media_id );

			if ( is_wp_error( $media ) ) {
				return $media;
			}

			if ( 'video' !== $this->media_type( $this->attachment_mime_type( $media ) ) ) {
				/* translators: %d: attachment ID. */
				return new \WP_Error( 'rtgodam_gallery_not_video', sprintf( __( 'Media ID %d is not a video; galleries hold videos only.', 'godam' ), $media_id ), array( 'status' => 400 ) );
			}

			$items[] = array(
				'blockName'    => 'godam/gallery-v2-item',
				'attrs'        => $this->editor_attributes( 'godam/gallery-v2-item', array( 'videoId' => $media_id ) ),
				'innerBlocks'  => array(),
				'innerHTML'    => '',
				'innerContent' => array(),
			);
		}

		// The gallery saves only its items, laid out as the editor lays out blocks.
		$content = array( "\n", null );

		for ( $i = 1, $count = count( $items ); $i < $count; $i++ ) {
			array_push( $content, "\n\n", null );
		}

		$content[] = "\n";

		return array(
			'name'      => self::BLOCKS['gallery'],
			'markup'    => $this->serialize( 'godam/gallery-v2', array( 'mode' => 'handpicked' ), $items, $content ),
			'media_ids' => $media_ids,
		);
	}

	/**
	 * Serialises a block the way the block editor does. The editor puts a line
	 * break inside a block's comments around its content; callers include it.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $name          Block name.
	 * @param array  $attrs         Attributes.
	 * @param array  $inner_blocks  Parsed inner blocks.
	 * @param array  $inner_content Inner content, with null where each inner block goes.
	 *
	 * @return string
	 */
	private function serialize( $name, array $attrs, array $inner_blocks = array(), array $inner_content = array() ) {
		return serialize_block(
			array(
				'blockName'    => $name,
				'attrs'        => $this->editor_attributes( $name, $attrs ),
				'innerBlocks'  => $inner_blocks,
				'innerHTML'    => implode( '', array_filter( $inner_content, 'is_string' ) ),
				'innerContent' => $inner_content,
			)
		);
	}

	/**
	 * The attributes the block editor writes into a block's comment: in the
	 * order the block declares them, leaving out unset values and values equal
	 * to the attribute's default.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $name  Block name.
	 * @param array  $attrs Attributes.
	 *
	 * @return array
	 */
	private function editor_attributes( $name, array $attrs ) {
		$type = \WP_Block_Type_Registry::get_instance()->get_registered( $name );

		if ( ! $type || empty( $type->attributes ) ) {
			return array_filter(
				$attrs,
				static function ( $value ) {
					return null !== $value;
				}
			);
		}

		$ordered = array();

		foreach ( $type->attributes as $key => $schema ) {
			if ( ! array_key_exists( $key, $attrs ) || null === $attrs[ $key ] ) {
				continue;
			}

			if ( array_key_exists( 'default', $schema ) && wp_json_encode( $schema['default'] ) === wp_json_encode( $attrs[ $key ] ) ) {
				continue;
			}

			$ordered[ $key ] = $attrs[ $key ];
		}

		return $ordered;
	}

	/**
	 * Text of an HTML fragment, as the browser's textContent gives it.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $html HTML.
	 *
	 * @return string
	 */
	private function text_content( $html ) {
		// Not wp_strip_all_tags(): it trims, and textContent keeps whitespace.
		return html_entity_decode( strip_tags( $html ), ENT_QUOTES | ENT_HTML5, 'UTF-8' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.strip_tags_strip_tags, WordPressVIPMinimum.Functions.StripTags.StripTagsOneParameter -- Matches the editor, which keeps script text as textContent does.
	}

	/**
	 * A GMT date from the REST API as the editor's ISO string, e.g.
	 * `2026-11-05T13:25:18.000+00:00`.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $date_gmt Date in GMT, `Y-m-d\TH:i:s`.
	 *
	 * @return string
	 */
	private function utc_iso( $date_gmt ) {
		$time = strtotime( $date_gmt . ' UTC' );

		return false === $time ? $date_gmt : gmdate( 'Y-m-d\TH:i:s', $time ) . '.000+00:00';
	}

	/**
	 * The REST collection route for a post type.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $post_type Post type.
	 *
	 * @return string
	 */
	private function posts_route( $post_type ) {
		$object = get_post_type_object( $post_type );
		$base   = ( $object && ! empty( $object->rest_base ) ) ? $object->rest_base : $post_type . 's';

		return '/wp/v2/' . $base;
	}
}
