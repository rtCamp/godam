<?php
/**
 * WooCommerce Reel Pops Product Metabox.
 *
 * Adds metabox to product edit page for configuring reel pops.
 *
 * @package RTGODAM
 */

namespace RTGODAM\Inc\WooCommerce;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class WC_Reel_Pops_Metabox
 */
class WC_Reel_Pops_Metabox {

	use Singleton;

	/**
	 * Meta key for storing reel pops config.
	 *
	 * @var string
	 */
	const META_KEY = '_godam_reel_pops_config';

	/**
	 * Fallback thumbnail URL.
	 *
	 * @var string
	 */
	const FALLBACK_THUMBNAIL = RTGODAM_URL . 'assets/src/images/video-thumbnail-default.png';

	/**
	 * Constructor.
	 */
	protected function __construct() {
		$this->init_hooks();
	}

	/**
	 * Initialize hooks.
	 */
	private function init_hooks() {
		add_action( 'add_meta_boxes', array( $this, 'add_metabox' ) );
		add_action( 'save_post_product', array( $this, 'save_metabox' ), 10 );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_assets' ) );
		add_action( 'wp_footer', array( $this, 'render_frontend_reel_pops' ) );
	}

	/**
	 * Add metabox to product edit screen.
	 */
	public function add_metabox() {
		$title = apply_filters(
			'rtgodam_reels_pops_metabox_title',
			__( 'GoDAM Reel Pops', 'godam' ) .
			' <span class="godam-pro-badge">' . __( 'Pro', 'godam' ) . '</span>'
		);

		add_meta_box(
			'godam_reel_pops_metabox',
			$title,
			array( $this, 'render_metabox' ),
			'product',
			'normal',
			'default'
		);
	}

	/**
	 * Enqueue admin assets.
	 *
	 * @param string $hook Current admin page hook.
	 */
	public function enqueue_admin_assets( $hook ) {
		if ( ! in_array( $hook, array( 'post.php', 'post-new.php' ), true ) ) {
			return;
		}

		$screen = get_current_screen();

		if ( ! $screen || 'product' !== $screen->post_type ) {
			return;
		}

		wp_enqueue_media();
		wp_enqueue_script( 'jquery-ui-sortable' );

		wp_add_inline_style(
			'wp-admin',
			'
			.godam-reel-pops-metabox { padding: 15px; }
			.godam-reel-pops-video-list {
				margin-top: 15px;
				display: flex;
				flex-wrap: wrap;
				gap: 10px;
				margin-bottom: 1.5rem;
			}
			.godam-reel-pops-video-item {
				width: calc(33.333% - 10px);
				min-width: 240px;
				position: relative;
				background: #f9f9f9;
				border: 1px solid #ddd;
				padding: 12px;
				border-radius: 4px;
				box-sizing: border-box;
			}
			.godam-reel-pops-video-item.ui-sortable-helper {
				box-shadow: 0 4px 12px rgba(0,0,0,0.15);
				opacity: 0.9;
			}
			.godam-reel-pops-drag-handle {
				display: flex;
				align-items: center;
				justify-content: center;
				width: 20px;
				min-width: 20px;
				cursor: grab;
				color: #aaa;
				font-size: 18px;
				user-select: none;
				padding-right: 4px;
				flex-shrink: 0;
			}
			.godam-reel-pops-drag-handle:active { cursor: grabbing; }
			.godam-reel-pops-video-placeholder {
				border: 2px dashed #b9b9b9;
				background: #f3f3f3;
				border-radius: 4px;
				min-height: 96px;
			}
			.godam-reel-pops-video-thumb {
				width: 70px;
				height: 70px;
				border-radius: 4px;
				background: #111;
				overflow: hidden;
				display: flex;
				align-items: center;
				justify-content: center;
				color: #fff;
				font-size: 11px;
			}
			.godam-reel-pops-video-thumb img {
				width: 100%;
				height: 100%;
				object-fit: cover;
			}
			.godam-reel-pops-video-item-header {
				display: flex;
				justify-content: flex-start;
				align-items: center;
				gap: 10px;
			}
			.godam-reel-pops-video-item-header strong {
				font-size: 14px;
				display: block;
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
				max-width: 180px;
			}
			.godam-reel-pops-video-meta { line-height: 1.4; }
			.godam-reel-pops-video-remove {
				position: absolute;
				top: 8px;
				right: 8px;
				width: 24px;
				height: 24px;
				border-radius: 50%;
				border: 1px solid #ccc;
				background: #fff;
				color: #a00;
				cursor: pointer;
				line-height: 1;
			}
			.godam-reel-pops-video-item-controls { display: flex; gap: 8px; }
			.godam-reel-pops-video-item input[type="text"] { width: 100%; }
			.godam-reel-pops-settings-grid {
				display: grid;
				grid-template-columns: repeat(2, 1fr);
				gap: 15px;
				margin-top: 15px;
			}
			.godam-reel-pops-setting-item label {
				display: block;
				margin-bottom: 5px;
				font-weight: 600;
			}
			.godam-reel-pops-setting-item select,
			.godam-reel-pops-setting-item input[type="number"] {
				width: 100%;
			}
			@media (max-width: 782px) {
				.godam-reel-pops-settings-grid { grid-template-columns: 1fr; }
				.godam-reel-pops-video-item { width: calc(50% - 10px); min-width: 0; }
			}
			@media (max-width: 580px) {
				.godam-reel-pops-video-item { width: 100%; }
			}
		'
		);
	}

	/**
	 * Render metabox content.
	 *
	 * @param \WP_Post $post Current post object.
	 */
	public function render_metabox( $post ) {
		wp_nonce_field( 'godam_reel_pops_metabox', 'godam_reel_pops_nonce' );

		$config = get_post_meta( $post->ID, self::META_KEY, true );
		if ( ! is_array( $config ) ) {
			$config = array();
		}

		$config = wp_parse_args(
			$config,
			array(
				'enabled'               => false,
				'videos'                => array(),
				'aspectRatio'           => '9-16',
				'position'              => 'bottom-right',
				'animation'             => 'slide-up',
				'animationDuration'     => 500,
				'durationSeconds'       => 5,
				'initialDelay'          => 3,
				'closePersistence'      => 'show_again',
				'enableAutoplay'        => true,
				'showMuteButton'        => true,
				'showPlayButton'        => false,
				'enableModalNavigation' => true,
				'popupWidth'            => 160,
				'mobilePopupWidth'      => 100,
				'bottomSpacing'         => 20,
				'sideSpacing'           => 20,
			)
		);

		$godam_has_valid_api_key = rtgodam_is_api_key_valid();

		if ( ! $godam_has_valid_api_key ) {

			echo '<div class="notice notice-warning inline">';
			echo '<p><strong>' . esc_html__( 'GoDAM Reel Pops is a Pro feature.', 'godam' ) . '</strong> ';
			echo '<a href="' . esc_url( RTGODAM_IO_API_BASE . '/pricing?utm_campaign=upgrade&utm_source=plugin&utm_medium=admin-notice&utm_content=reel_pops' ) . '" target="_blank">';
			echo esc_html__( 'Upgrade your plan to unlock it.', 'godam' );
			echo '</a></p>';
			echo '</div>';

			echo '<div class="godam-disabled-ui">';
		}

		$disabled_attr = ! $godam_has_valid_api_key ? 'disabled="disabled"' : '';

		?>
		<div class="godam-reel-pops-metabox">
			<p>
				<label>
					<input type="checkbox" name="godam_reel_pops[enabled]" value="1" <?php checked( $config['enabled'], true ); ?> />
					<strong><?php esc_html_e( 'Enable Reel Pops for this product', 'godam' ); ?></strong>
				</label>
			</p>
			<p class="description">
				<?php esc_html_e( 'When enabled, the configured reel popup will appear on this product\'s single page. When users click the reel, they will see this product in the modal.', 'godam' ); ?>
			</p>

			<div class="godam-reel-pops-video-selection">
				<h4><?php esc_html_e( 'Videos', 'godam' ); ?></h4>
				<div class="godam-reel-pops-video-list" id="godam-reel-pops-video-list">
					<?php
					if ( ! empty( $config['videos'] ) && is_array( $config['videos'] ) ) {
						foreach ( $config['videos'] as $index => $video_id ) {
							$this->render_video_item( $index, $video_id );
						}
					}
					?>
				</div>
				<button type="button" class="button" id="godam-reel-pops-add-video" <?php echo esc_attr( $disabled_attr ); ?>>
					<?php esc_html_e( 'Select Videos', 'godam' ); ?>
				</button>
			</div>

			<div class="godam-reel-pops-settings-grid">
				<div class="godam-reel-pops-setting-item">
					<label for="godam_reel_pops_aspect_ratio"><?php esc_html_e( 'Aspect Ratio', 'godam' ); ?></label>
					<select name="godam_reel_pops[aspectRatio]" id="godam_reel_pops_aspect_ratio">
						<option value="9-16" <?php selected( $config['aspectRatio'], '9-16' ); ?>><?php esc_html_e( '9:16 (Reels/Stories)', 'godam' ); ?></option>
						<option value="16-9" <?php selected( $config['aspectRatio'], '16-9' ); ?>><?php esc_html_e( '16:9 (Landscape)', 'godam' ); ?></option>
						<option value="4-3" <?php selected( $config['aspectRatio'], '4-3' ); ?>><?php esc_html_e( '4:3 (Standard)', 'godam' ); ?></option>
					</select>
				</div>

				<div class="godam-reel-pops-setting-item">
					<label for="godam_reel_pops_position"><?php esc_html_e( 'Position', 'godam' ); ?></label>
					<select name="godam_reel_pops[position]" id="godam_reel_pops_position">
						<option value="bottom-right" <?php selected( $config['position'], 'bottom-right' ); ?>><?php esc_html_e( 'Bottom Right', 'godam' ); ?></option>
						<option value="bottom-left" <?php selected( $config['position'], 'bottom-left' ); ?>><?php esc_html_e( 'Bottom Left', 'godam' ); ?></option>
					</select>
				</div>

				<div class="godam-reel-pops-setting-item">
					<label for="godam_reel_pops_animation"><?php esc_html_e( 'Animation Type', 'godam' ); ?></label>
					<select name="godam_reel_pops[animation]" id="godam_reel_pops_animation">
						<option value="slide-up" <?php selected( $config['animation'], 'slide-up' ); ?>><?php esc_html_e( 'Slide Up', 'godam' ); ?></option>
						<option value="slide-left" <?php selected( $config['animation'], 'slide-left' ); ?>><?php esc_html_e( 'Slide Left', 'godam' ); ?></option>
						<option value="slide-right" <?php selected( $config['animation'], 'slide-right' ); ?>><?php esc_html_e( 'Slide Right', 'godam' ); ?></option>
						<option value="fade" <?php selected( $config['animation'], 'fade' ); ?>><?php esc_html_e( 'Fade', 'godam' ); ?></option>
						<option value="bounce" <?php selected( $config['animation'], 'bounce' ); ?>><?php esc_html_e( 'Bounce', 'godam' ); ?></option>
						<option value="scale" <?php selected( $config['animation'], 'scale' ); ?>><?php esc_html_e( 'Scale', 'godam' ); ?></option>
					</select>
				</div>

				<div class="godam-reel-pops-setting-item">
					<label for="godam_reel_pops_animation_duration"><?php esc_html_e( 'Animation Duration (ms)', 'godam' ); ?></label>
					<input type="number" name="godam_reel_pops[animationDuration]" id="godam_reel_pops_animation_duration" value="<?php echo esc_attr( $config['animationDuration'] ); ?>" min="200" max="2000" step="100" />
				</div>

				<div class="godam-reel-pops-setting-item">
					<label for="godam_reel_pops_duration_seconds"><?php esc_html_e( 'Duration per Video (seconds)', 'godam' ); ?></label>
					<input type="number" name="godam_reel_pops[durationSeconds]" id="godam_reel_pops_duration_seconds" value="<?php echo esc_attr( $config['durationSeconds'] ); ?>" min="1" max="30" step="1" />
				</div>

				<div class="godam-reel-pops-setting-item">
					<label for="godam_reel_pops_initial_delay"><?php esc_html_e( 'Show After Page Load (seconds)', 'godam' ); ?></label>
					<input type="number" name="godam_reel_pops[initialDelay]" id="godam_reel_pops_initial_delay" value="<?php echo esc_attr( $config['initialDelay'] ); ?>" min="0" max="30" step="1" />
				</div>

				<div class="godam-reel-pops-setting-item">
					<label for="godam_reel_pops_close_persistence"><?php esc_html_e( 'After Close', 'godam' ); ?></label>
					<select name="godam_reel_pops[closePersistence]" id="godam_reel_pops_close_persistence">
						<option value="show_again" <?php selected( $config['closePersistence'], 'show_again' ); ?>><?php esc_html_e( 'Show again on page reload', 'godam' ); ?></option>
						<option value="hide_after_close" <?php selected( $config['closePersistence'], 'hide_after_close' ); ?>><?php esc_html_e( 'Stay hidden after close (this browser)', 'godam' ); ?></option>
					</select>
				</div>

				<div class="godam-reel-pops-setting-item">
					<label for="godam_reel_pops_popup_width"><?php esc_html_e( 'Popup Width (px)', 'godam' ); ?></label>
					<input type="number" name="godam_reel_pops[popupWidth]" id="godam_reel_pops_popup_width" value="<?php echo esc_attr( $config['popupWidth'] ); ?>" min="80" max="300" step="10" />
				</div>

				<div class="godam-reel-pops-setting-item">
					<label for="godam_reel_pops_mobile_popup_width"><?php esc_html_e( 'Mobile Popup Width (px)', 'godam' ); ?></label>
					<input type="number" name="godam_reel_pops[mobilePopupWidth]" id="godam_reel_pops_mobile_popup_width" value="<?php echo esc_attr( $config['mobilePopupWidth'] ); ?>" min="80" max="300" step="10" />
				</div>

				<div class="godam-reel-pops-setting-item">
					<label for="godam_reel_pops_bottom_spacing"><?php esc_html_e( 'Bottom Spacing (px)', 'godam' ); ?></label>
					<input type="number" name="godam_reel_pops[bottomSpacing]" id="godam_reel_pops_bottom_spacing" value="<?php echo esc_attr( $config['bottomSpacing'] ); ?>" min="0" max="100" step="5" />
				</div>

				<div class="godam-reel-pops-setting-item">
					<label for="godam_reel_pops_side_spacing"><?php esc_html_e( 'Side Spacing (px)', 'godam' ); ?></label>
					<input type="number" name="godam_reel_pops[sideSpacing]" id="godam_reel_pops_side_spacing" value="<?php echo esc_attr( $config['sideSpacing'] ); ?>" min="0" max="100" step="5" />
				</div>

				<div class="godam-reel-pops-setting-item">
					<label>
						<input type="checkbox" name="godam_reel_pops[enableAutoplay]" value="1" <?php checked( $config['enableAutoplay'], true ); ?> />
						<?php esc_html_e( 'Enable Autoplay (muted)', 'godam' ); ?>
					</label>
					<p class="description"><?php esc_html_e( 'Videos will autoplay muted. Disable to show play button overlay.', 'godam' ); ?></p>
				</div>

				<div class="godam-reel-pops-setting-item">
					<label>
						<input type="checkbox" name="godam_reel_pops[showMuteButton]" value="1" <?php checked( $config['showMuteButton'], true ); ?> />
						<?php esc_html_e( 'Show Mute/Unmute Button', 'godam' ); ?>
					</label>
				</div>

				<div class="godam-reel-pops-setting-item">
					<label>
						<input type="checkbox" name="godam_reel_pops[showPlayButton]" value="1" <?php checked( $config['showPlayButton'], true ); ?> />
						<?php esc_html_e( 'Show Play/Pause Button Overlay', 'godam' ); ?>
					</label>
				</div>

				<div class="godam-reel-pops-setting-item">
					<label>
						<input type="checkbox" name="godam_reel_pops[enableModalNavigation]" value="1" <?php checked( $config['enableModalNavigation'], true ); ?> />
						<?php esc_html_e( 'Enable video navigations on modal', 'godam' ); ?>
					</label>
				</div>
			</div>
		</div>

		<script type="text/javascript">
		jQuery(document).ready(function($) {
			let videoIndex = <?php echo count( $config['videos'] ); ?>;
			const existingVideoIds = [];
			const defaultThumb = '<?php echo esc_js( self::FALLBACK_THUMBNAIL ); ?>';

			$('#godam-reel-pops-video-list .godam-video-id').each(function() {
				const id = parseInt($(this).val(), 10);
				if (id > 0 && existingVideoIds.indexOf(id) === -1) {
					existingVideoIds.push(id);
				}
			});

			// Make video list sortable
			$('#godam-reel-pops-video-list').sortable({
				handle: '.godam-reel-pops-drag-handle',
				items: '> .godam-reel-pops-video-item',
				placeholder: 'godam-reel-pops-video-placeholder',
				forcePlaceholderSize: true,
				tolerance: 'pointer',
				cancel: 'button, input, textarea, select, option, a',
				start: function(event, ui) {
					ui.placeholder.height(ui.item.outerHeight());
					ui.placeholder.width(ui.item.outerWidth());
				},
				update: function() {
					reindexVideoItems();
				}
			});

			const createVideoItem = (index, attachment) => {
				const thumb = (attachment.meta && attachment.meta.rtgodam_media_video_thumbnail) || (attachment.image && attachment.image.src) || (attachment.sizes && attachment.sizes.thumbnail && attachment.sizes.thumbnail.url) || attachment.icon || defaultThumb;
				const title = attachment.title || '<?php echo esc_js( __( 'Untitled video', 'godam' ) ); ?>';
				const thumbHtml = thumb
					? `<img src="${thumb}" alt="" />`
					: '<span><?php esc_html_e( 'Video', 'godam' ); ?></span>';

				return `
					<div class="godam-reel-pops-video-item" data-index="${index}" data-video-id="${attachment.id}">
						<button type="button" class="godam-reel-pops-video-remove" aria-label="<?php esc_attr_e( 'Remove video', 'godam' ); ?>">✕</button>
						<div class="godam-reel-pops-video-item-header">
							<div class="godam-reel-pops-drag-handle" title="<?php esc_attr_e( 'Drag to reorder', 'godam' ); ?>">⠿</div>
							<div class="godam-reel-pops-video-thumb">${thumbHtml}</div>
							<div class="godam-reel-pops-video-meta">
								<strong class="godam-reel-pops-video-title">${title}</strong>
								<span class="godam-video-id-display"><?php esc_html_e( 'ID:', 'godam' ); ?> ${attachment.id}</span>
							</div>
						</div>
						<input type="hidden" name="godam_reel_pops[videos][${index}]" class="godam-video-id" value="${attachment.id}" />
					</div>
				`;
			};

			const reindexVideoItems = () => {
				$('#godam-reel-pops-video-list .godam-reel-pops-video-item').each(function(index) {
					const item = $(this);
					item.attr('data-index', index);
					item.find('.godam-video-id').attr('name', `godam_reel_pops[videos][${index}]`);
				});
				videoIndex = $('#godam-reel-pops-video-list .godam-reel-pops-video-item').length;
			};

			const hasValidAPIKey = <?php echo $godam_has_valid_api_key ? 'true' : 'false'; ?>;

			// Add videos button
			$('#godam-reel-pops-add-video').on('click', function(e) {
				if ( ! hasValidAPIKey ) {
					e.preventDefault();
					e.stopImmediatePropagation();

					alert('<?php echo esc_js( __( 'This is a Pro feature. Please upgrade to use it.', 'godam' ) ); ?>');
					return false;
				}

				const mediaFrame = wp.media({
					title: '<?php esc_html_e( 'Select Videos', 'godam' ); ?>',
					library: { type: 'video' },
					multiple: true,
					button: { text: '<?php esc_html_e( 'Use Selected Videos', 'godam' ); ?>' }
				});

				mediaFrame.on('select', function() {
					const selection = mediaFrame.state().get('selection').toJSON();
					selection.forEach(function(attachment) {
						if (!attachment.id || existingVideoIds.indexOf(attachment.id) !== -1) {
							return;
						}

						existingVideoIds.push(attachment.id);
						$('#godam-reel-pops-video-list').append(createVideoItem(videoIndex, attachment));
						videoIndex++;
					});

					reindexVideoItems();
				});

				mediaFrame.open();
			});

			// Remove video
			$(document).on('click', '.godam-reel-pops-video-remove', function() {
				const item = $(this).closest('.godam-reel-pops-video-item');
				const id = parseInt(item.attr('data-video-id'), 10);
				if (id > 0) {
					const idIndex = existingVideoIds.indexOf(id);
					if (idIndex !== -1) {
						existingVideoIds.splice(idIndex, 1);
					}
				}
				item.remove();
				reindexVideoItems();
			});

			reindexVideoItems();
		});
		</script>
		<?php

		if ( ! rtgodam_is_api_key_valid() ) {
			echo '</div>';
		}
	}

	/**
	 * Render a single video item.
	 *
	 * @param int $index Video index.
	 * @param int $video_id Video ID.
	 */
	private function render_video_item( $index, $video_id ) {
		$video_id    = absint( $video_id );
		$video_title = $video_id ? get_the_title( $video_id ) : '';
		$thumb_url   = self::FALLBACK_THUMBNAIL;

		if ( $video_id ) {
			$thumb_url = get_post_meta( $video_id, 'rtgodam_media_video_thumbnail', true );

			if ( empty( $thumb_url ) ) {
				$thumb_url = wp_get_attachment_image_url( $video_id, 'thumbnail' );
			}

			if ( empty( $thumb_url ) ) {
				$thumb_url = get_the_post_thumbnail_url( $video_id, 'thumbnail' );
			}

			if ( empty( $thumb_url ) ) {
				$thumbnail_id = get_post_thumbnail_id( $video_id );
				if ( $thumbnail_id ) {
					$thumb_url = wp_get_attachment_image_url( $thumbnail_id, 'thumbnail' );
				}
			}

			if ( empty( $thumb_url ) ) {
				$thumb_url = self::FALLBACK_THUMBNAIL;
			}
		}
		?>
		<div class="godam-reel-pops-video-item" data-index="<?php echo esc_attr( $index ); ?>" data-video-id="<?php echo esc_attr( $video_id ); ?>">
			<button type="button" class="godam-reel-pops-video-remove" aria-label="<?php esc_attr_e( 'Remove video', 'godam' ); ?>">✕</button>
			<div class="godam-reel-pops-video-item-header">
				<div class="godam-reel-pops-drag-handle" title="<?php esc_attr_e( 'Drag to reorder', 'godam' ); ?>">⠿</div>
				<div class="godam-reel-pops-video-thumb">
					<img src="<?php echo esc_url( $thumb_url ); ?>" alt="" />
				</div>
				<div class="godam-reel-pops-video-meta">
					<strong class="godam-reel-pops-video-title"><?php echo esc_html( ! empty( $video_title ) ? $video_title : __( 'Untitled video', 'godam' ) ); ?></strong>
					<span class="godam-video-id-display"><?php esc_html_e( 'ID:', 'godam' ); ?> <?php echo esc_html( $video_id ); ?></span>
				</div>
			</div>
			<input type="hidden" name="godam_reel_pops[videos][<?php echo esc_attr( $index ); ?>]" class="godam-video-id" value="<?php echo esc_attr( $video_id ); ?>" />
		</div>
		<?php
	}

	/**
	 * Save metabox data.
	 *
	 * @param int $post_id Post ID.
	 */
	public function save_metabox( $post_id ) {
		if ( ! rtgodam_is_api_key_valid() ) {
			return;
		}

		// Verify nonce.
		if ( ! isset( $_POST['godam_reel_pops_nonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['godam_reel_pops_nonce'] ) ), 'godam_reel_pops_metabox' ) ) {
			return;
		}

		// Check autosave.
		if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
			return;
		}

		// Check permissions.
		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			return;
		}

		// Get and sanitize data.
		$data = isset( $_POST['godam_reel_pops'] ) ? wp_unslash( $_POST['godam_reel_pops'] ) : array(); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized

		$config = array(
			'enabled'               => isset( $data['enabled'] ) && '1' === $data['enabled'],
			'videos'                => array(),
			'aspectRatio'           => isset( $data['aspectRatio'] ) ? sanitize_text_field( $data['aspectRatio'] ) : '9-16',
			'position'              => isset( $data['position'] ) ? sanitize_text_field( $data['position'] ) : 'bottom-right',
			'animation'             => isset( $data['animation'] ) ? sanitize_text_field( $data['animation'] ) : 'slide-up',
			'animationDuration'     => isset( $data['animationDuration'] ) ? absint( $data['animationDuration'] ) : 500,
			'durationSeconds'       => isset( $data['durationSeconds'] ) ? absint( $data['durationSeconds'] ) : 5,
			'initialDelay'          => isset( $data['initialDelay'] ) ? absint( $data['initialDelay'] ) : 3,
			'closePersistence'      => isset( $data['closePersistence'] ) ? sanitize_text_field( $data['closePersistence'] ) : 'show_again',
			'enableAutoplay'        => isset( $data['enableAutoplay'] ) && '1' === $data['enableAutoplay'],
			'showMuteButton'        => isset( $data['showMuteButton'] ) && '1' === $data['showMuteButton'],
			'showPlayButton'        => isset( $data['showPlayButton'] ) && '1' === $data['showPlayButton'],
			'enableModalNavigation' => isset( $data['enableModalNavigation'] ) && '1' === $data['enableModalNavigation'],
			'popupWidth'            => isset( $data['popupWidth'] ) ? absint( $data['popupWidth'] ) : 160,
			'mobilePopupWidth'      => isset( $data['mobilePopupWidth'] ) ? absint( $data['mobilePopupWidth'] ) : 100,
			'bottomSpacing'         => isset( $data['bottomSpacing'] ) ? absint( $data['bottomSpacing'] ) : 20,
			'sideSpacing'           => isset( $data['sideSpacing'] ) ? absint( $data['sideSpacing'] ) : 20,
		);

		// Sanitize videos.
		if ( isset( $data['videos'] ) && is_array( $data['videos'] ) ) {
			foreach ( $data['videos'] as $video_id ) {
				if ( absint( $video_id ) > 0 ) {
					$config['videos'][] = absint( $video_id );
				}
			}
		}

		// Save or delete meta.
		if ( $config['enabled'] && ! empty( $config['videos'] ) ) {
			update_post_meta( $post_id, self::META_KEY, $config );
		} else {
			delete_post_meta( $post_id, self::META_KEY );
		}
	}

	/**
	 * Render reel pops on frontend for single product pages.
	 */
	public function render_frontend_reel_pops() {
		if ( ! rtgodam_is_api_key_valid() ) {
			return;
		}

		if ( ! is_singular( 'product' ) ) {
			return;
		}

		$product_id = get_the_ID();
		$config     = get_post_meta( $product_id, self::META_KEY, true );

		if ( ! is_array( $config ) || empty( $config['enabled'] ) || empty( $config['videos'] ) ) {
			return;
		}

		$config = wp_parse_args(
			$config,
			array(
				'aspectRatio'           => '9-16',
				'position'              => 'bottom-right',
				'animation'             => 'slide-up',
				'animationDuration'     => 500,
				'durationSeconds'       => 5,
				'initialDelay'          => 3,
				'closePersistence'      => 'show_again',
				'enableAutoplay'        => true,
				'showMuteButton'        => true,
				'showPlayButton'        => false,
				'enableModalNavigation' => true,
				'popupWidth'            => 160,
				'mobilePopupWidth'      => 100,
				'bottomSpacing'         => 20,
				'sideSpacing'           => 20,
			)
		);

		// Convert metabox config to shortcode attributes.
		$video_ids          = array();
		$product_ids_groups = array();

		foreach ( $config['videos'] as $video_id ) {
			$video_ids[]          = absint( $video_id );
			$product_ids_groups[] = (string) $product_id;
		}

		// Build shortcode attributes.
		$shortcode_atts = array(
			'video_ids'               => implode( ',', $video_ids ),
			'product_ids'             => implode( '|', $product_ids_groups ),
			'aspect_ratio'            => sanitize_text_field( $config['aspectRatio'] ),
			'position'                => sanitize_text_field( $config['position'] ),
			'animation'               => sanitize_text_field( $config['animation'] ),
			'animation_duration'      => absint( $config['animationDuration'] ),
			'duration_seconds'        => absint( $config['durationSeconds'] ),
			'initial_delay'           => isset( $config['initialDelay'] ) ? absint( $config['initialDelay'] ) : 3,
			'close_persistence'       => sanitize_text_field( $config['closePersistence'] ),
			'enable_autoplay'         => $config['enableAutoplay'] ? 'true' : 'false',
			'show_mute_button'        => ! empty( $config['showMuteButton'] ) ? 'true' : 'false',
			'show_play_button'        => ! empty( $config['showPlayButton'] ) ? 'true' : 'false',
			'enable_modal_navigation' => ! empty( $config['enableModalNavigation'] ) ? 'true' : 'false',
			'popup_width'             => absint( $config['popupWidth'] ),
			'mobile_popup_width'      => absint( $config['mobilePopupWidth'] ),
			'bottom_spacing'          => absint( $config['bottomSpacing'] ),
			'side_spacing'            => absint( $config['sideSpacing'] ),
			'block_id'                => 'godam-reel-pops-product-' . $product_id,
		);

		// Build shortcode string.
		$shortcode_parts = array();
		foreach ( $shortcode_atts as $key => $value ) {
			if ( '' !== $value ) {
				$shortcode_parts[] = sprintf( '%s="%s"', $key, esc_attr( $value ) );
			}
		}

		$shortcode = '[godam_video_reel_pops ' . implode( ' ', $shortcode_parts ) . ']';

		// Render via shortcode.
		echo do_shortcode( $shortcode ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}
}
