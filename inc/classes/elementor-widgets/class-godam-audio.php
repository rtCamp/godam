<?php
/**
 * Register Custom Widget - GoDAM Audio
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Elementor_Widgets;

use Elementor\Controls_Manager;

/**
 * GoDAM Gallery Widget.
 */
class Godam_Audio extends Base {

	/**
	 * Default config for Calculate Savings Widget.
	 *
	 * @return array
	 */
	public function set_default_config() {
		return array(
			'name'            => 'godam-audio',
			'title'           => _x( 'GoDAM Audio', 'Widget Title', 'godam' ),
			'icon'            => 'eicon-headphones',
			'categories'      => array( 'godam' ),
			'keywords'        => array( 'godam', 'audio' ),
			'depended_styles' => array( 'elementor-godam-audio-style' ),
		);
	}

	/**
	 * Register Calculate Savings Widget Controls.
	 *
	 * @access protected
	 */
	protected function register_controls() {
		$this->start_controls_section(
			'section_audio_settings',
			array(
				'label' => __( 'Widget Settings', 'godam' ),
			)
		);

		$this->add_control(
			'audio-file',
			array(
				'label'       => __( 'Audio File', 'godam' ),
				'type'        => Controls_Manager::MEDIA,
				'media_types' => array( 'audio' ),
				'description' => __( 'Select the audio file', 'godam' ),
			)
		);

		$this->add_control(
			'autoplay',
			array(
				'label'     => __( 'Autoplay', 'godam' ),
				'type'      => Controls_Manager::SWITCHER,
				'default'   => 'no',
				'condition' => array(
					'audio-file[url]!' => '',
				),
			)
		);

		$this->add_control(
			'loop',
			array(
				'label'     => __( 'Loop', 'godam' ),
				'type'      => Controls_Manager::SWITCHER,
				'default'   => 'no',
				'condition' => array(
					'audio-file[url]!' => '',
				),
			)
		);

		$this->add_control(
			'caption',
			array(
				'label'     => __( 'Show Caption', 'godam' ),
				'type'      => Controls_Manager::SWITCHER,
				'default'   => 'no',
				'condition' => array(
					'audio-file[url]!' => '',
				),
			)
		);

		$this->add_control(
			'preload',
			array(
				'label'     => __( 'Preload', 'godam' ),
				'type'      => Controls_Manager::SELECT,
				'default'   => 'metadata',
				'options'   => array(
					''         => esc_html__( 'Browser default', 'godam' ),
					'auto'     => esc_html__( 'Auto', 'godam' ),
					'metadata' => esc_html__( 'Metadata', 'godam' ),
					'none'     => esc_html_x( 'None', 'Preload value', 'godam' ),
				),
				'condition' => array(
					'audio-file[url]!' => '',
				),
			)
		);

		$this->end_controls_section();
	}

	/**
	 * Render GoDAM Audio widget.
	 *
	 * @access protected
	 */
	protected function render() {
		$attachement   = $this->get_settings_for_display( 'audio-file' );
		$attachment_id = $attachement['id'];
		$show_caption  = 'yes' === $this->get_settings_for_display( 'caption' ) ? true : false;
		$caption       = wp_get_attachment_caption( $attachment_id ) ?? '';
		$autoplay      = 'yes' === $this->get_settings_for_display( 'autoplay' ) ? 'autoplay' : '';
		$loop          = 'yes' === $this->get_settings_for_display( 'loop' ) ? 'loop' : '';
		$preload       = $this->get_settings_for_display( 'preload' );

		if ( ! $attachment_id ) {
			return;
		}

		$primary_audio = get_post_meta( $attachment_id, 'rtgodam_transcoded_url', true );
		$backup_audio  = wp_get_attachment_url( $attachment_id );

		if ( empty( $primary_audio ) && empty( $backup_audio ) ) {
			return;
		}

		?>
		<figure class="elementor-godam-audio">
			<audio controls <?php echo esc_attr( $autoplay ); ?> <?php echo esc_attr( $loop ); ?> preload="<?php echo esc_attr( $preload ); ?>">
				<?php if ( ! empty( $primary_audio ) ) : ?>
					<source src="<?php echo esc_url( $primary_audio ); ?>" type="audio/mpeg" />
				<?php endif; ?>

				<?php if ( ! empty( $backup_audio ) ) : ?>
					<source src="<?php echo esc_url( $backup_audio ); ?>" type="audio/mpeg" />
				<?php endif; ?>

				<?php __( 'Your browser does not support the audio element.', 'godam' ); ?>
			</audio>

			<?php if ( $show_caption && ! empty( $caption ) ) : ?>
				<figcaption class="wp-element-caption">
					<?php echo wp_kses_post( $caption ); ?>
				</figcaption>
			<?php endif; ?>
		</figure>
		<?php
	}
}
