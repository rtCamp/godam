<?php
/**
 * Elementor control - Godam Media control.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Elementor_Controls;

use RTGODAM\Inc\Assets;
use RTGODAM\Inc\Pages;

/**
 * FileSelect control.
 *
 * A control for selecting any type of files.
 *
 * @since 1.0.0
 */
class Godam_Media extends \Elementor\Base_Data_Control {

	/**
	 * Get media control type.
	 *
	 * Retrieve the control type, in this case `media`.
	 *
	 * @return string Control type.
	 */
	public function get_type() {
		return 'godam-media';
	}

	/**
	 * Get media control default values.
	 *
	 * Retrieve the default value of the media control. Used to return the default
	 * values while initializing the media control.
	 *
	 * @return array Control default value.
	 */
	public function get_default_value() {
		return array(
			'id'  => '',
			'url' => '',
		);
	}

	/**
	 * Get media control default settings.
	 *
	 * Retrieve the default settings of the media control. Used to return the default
	 * values while initializing the media control.
	 *
	 * @return array Control default settings.
	 */
	protected function get_default_settings() {
		return array(
			'media_type'  => 'text/vtt',
			'media_types' => array(
				'text/vtt',
			),
		);
	}

	/**
	 * Enqueue media control scripts and styles.
	 *
	 * Used to register and enqueue custom scripts and styles used by the media
	 * control.
	 *
	 * @return void
	 */
	public function enqueue() {
		wp_enqueue_media();
		wp_enqueue_style( 'thickbox' );
		wp_enqueue_script( 'media-upload' );
		wp_enqueue_script( 'thickbox' );

		wp_register_script( 'godam-elementor-editor', RTGODAM_URL . 'assets/build/js/godam-elementor-editor.min.js', array( 'jquery' ), '1.0.0', true );
		wp_enqueue_script( 'godam-elementor-editor' );
		wp_enqueue_style( 'godam-media-library' );

		Assets::get_instance()->admin_enqueue_scripts();
		Pages::get_instance()->admin_enqueue_scripts();
	}

	/**
	 * Render media control output in the editor.
	 *
	 * Used to generate the control HTML in the editor using Underscore JS
	 * template. The variables for the class are available using `data` JS
	 * object.
	 *
	 * @return void
	 */
	public function content_template() {
		?>
		<#
			// For BC.
			if ( data.media_type ) {
				data.media_types = [ data.media_type ];
			}

			if ( data.should_include_svg_inline_option ) {
				data.media_types.push( 'svg' );
			}

			// Determine if the current media type is viewable.
			const isViewable = () => {
				const viewable = [
					'image',
					'video',
					'svg',
				];

				// Make sure that all media types are viewable.
				return data.media_types.every( ( type ) => viewable.includes( type ) );
			};

			// Get the preview type for the current media type.
			const getPreviewType = () => {
				if ( data.media_types.includes( 'video' ) ) {
					return 'video';
				}

				if ( data.media_types.includes( 'image' ) || data.media_types.includes( 'svg' ) ) {
					return 'image';
				}

				return 'none';
			}

			// Retrieve a button label by media type.
			const getButtonLabel = ( mediaType ) => {
				switch( mediaType ) {
					case 'image':
						return '<?php esc_html_e( 'Choose Image', 'godam' ); ?>';

					case 'video':
						return '<?php esc_html_e( 'Choose Video', 'godam' ); ?>';

					case 'svg':
						return '<?php esc_html_e( 'Choose SVG', 'godam' ); ?>';

					default:
						return '<?php esc_html_e( 'Choose File', 'godam' ); ?>';
				}
			}
		#>
		<div class="elementor-control-field elementor-control-media">
			<label class="elementor-control-title">{{{ data.label }}}</label><?php // phpcs:ignore WordPressVIPMinimum.Security.Mustache.OutputNotation ?>
			<#
			if ( isViewable() ) {
				let inputWrapperClasses = 'elementor-control-input-wrapper';

				if ( ! data.label_block ) {
					inputWrapperClasses += ' elementor-control-unit-5';
				}
			#>
				<div class="{{{ inputWrapperClasses }}}"><?php // phpcs:ignore WordPressVIPMinimum.Security.Mustache.OutputNotation ?>
					<div class="elementor-control-media__content elementor-control-tag-area elementor-control-preview-area">
						<div class="elementor-control-media-area">
							<div class="elementor-control-media__remove elementor-control-media__content__remove" data-tooltip="<?php echo esc_attr__( 'Remove', 'godam' ); ?>">
								<i class="eicon-trash-o" aria-hidden="true"></i>
								<span class="elementor-screen-only"><?php echo esc_html__( 'Remove', 'godam' ); ?></span>
							</div>
							<#
								switch( getPreviewType() ) {
									case 'image':
										#>
										<div class="elementor-control-media__preview"></div>
										<#
										break;

									case 'video':
										#>
										<video class="elementor-control-media-video" preload="metadata"></video>
										<i class="eicon-video-camera" aria-hidden="true"></i>
										<#
										break;
								}
							#>
						</div>
						<div class="elementor-control-media-upload-button elementor-control-media__content__upload-button">
							<i class="eicon-plus-circle" aria-hidden="true"></i>
							<span class="elementor-screen-only"><?php echo esc_html__( 'Add', 'godam' ); ?></span>
						</div>
						<div class="elementor-control-media__tools elementor-control-dynamic-switcher-wrapper">
							<#
								data.media_types.forEach( ( type ) => {
									#>
									<div class="elementor-control-media__tool elementor-control-media__replace" data-media-type="{{{ type }}}">{{{ getButtonLabel( type ) }}}</div><?php // phpcs:ignore WordPressVIPMinimum.Security.Mustache.OutputNotation ?>
									<#
								} );
							#>
						</div>
					</div>
				</div>
			<# } /* endif isViewable() */ else { #>
				<div class="elementor-control-media__file elementor-control-preview-area">
					<div class="elementor-control-media__file__content">
						<div class="elementor-control-media__file__content__label"><?php echo esc_html__( 'Click the media icon to upload file', 'godam' ); ?></div>
						<div class="elementor-control-media__file__content__info">
							<div class="elementor-control-media__file__content__info__icon">
								<i class="eicon-document-file"></i>
							</div>
							<div class="elementor-control-media__file__content__info__name"></div>
						</div>
					</div>
					<div class="elementor-control-media__file__controls">
						<div class="elementor-control-media__remove elementor-control-media__file__controls__remove" data-tooltip="<?php echo esc_attr__( 'Remove', 'godam' ); ?>">
							<i class="eicon-trash-o" aria-hidden="true"></i>
							<span class="elementor-screen-only"><?php echo esc_html__( 'Remove', 'godam' ); ?></span>
						</div>
						<div class="elementor-control-media__file__controls__upload-button elementor-control-media-upload-button" data-tooltip="<?php echo esc_attr__( 'Upload', 'godam' ); ?>">
							<i class="eicon-upload" aria-hidden="true"></i>
							<span class="elementor-screen-only"><?php echo esc_html__( 'Upload', 'godam' ); ?></span>
						</div>
					</div>
				</div>
			<# } #>
			<# if ( data.description ) { #>
				<div class="elementor-control-field-description">{{{ data.description }}}</div> <?php // phpcs:ignore WordPressVIPMinimum.Security.Mustache.OutputNotation ?>
			<# } #>

			<input type="hidden" data-setting="{{ data.name }}"/>
		</div>
		<?php
	}
}
