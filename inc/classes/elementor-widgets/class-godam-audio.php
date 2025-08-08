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
	 * Default config for GoDAM Audio Widget.
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
	 * Register Widget Controls.
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
				'type'        => 'godam-media',
				'label_block' => true,
				'media_type'  => 'audio',
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
	 * Render GoDAM Audio widget output on the frontend.
	 *
	 * @access protected
	 */
	protected function render() {
		$attachment    = $this->get_settings_for_display( 'audio-file' );
		$attachment_id = $attachment['id'];
		$show_caption  = 'yes' === $this->get_settings_for_display( 'caption' );
		$caption       = wp_get_attachment_caption( $attachment_id ) ?? '';
		$autoplay      = 'yes' === $this->get_settings_for_display( 'autoplay' ) ? 'autoplay' : '';
		$loop          = 'yes' === $this->get_settings_for_display( 'loop' ) ? 'loop' : '';
		$preload       = $this->get_settings_for_display( 'preload' );

		if ( ! $attachment_id ) {
			return;
		}

		$sources = array();

		if ( is_numeric( $attachment_id ) ) {
			$attachment_id = intval( $attachment_id );

			$primary_url  = get_post_meta( $attachment_id, 'rtgodam_transcoded_url', true );
			$fallback_url = wp_get_attachment_url( $attachment_id );

			if ( ! empty( $primary_url ) ) {
				$sources[] = array(
					'src'  => $primary_url,
					'type' => 'audio/mpeg',
				);
			}

			if ( ! empty( $fallback_url ) ) {
				$sources[] = array(
					'src'  => $fallback_url,
					'type' => 'audio/mpeg',
				);
			}
		} else {
			// Handle non-numeric (external or remote) attachments.
			if ( ! empty( $attachment['url'] ) ) {
				$sources[] = array(
					'src'  => $attachment['url'],
					'type' => 'audio/mpeg',
				);
			}

			if ( ! empty( $attachment['sources'] ) && is_array( $attachment['sources'] ) ) {
				foreach ( $attachment['sources'] as $source ) {
					if ( ! empty( $source['src'] ) ) {
						$sources[] = array(
							'src'  => $source['src'],
							'type' => $source['type'] ?? 'audio/mpeg',
						);
					}
				}
			}
		}

		if ( empty( $sources ) ) {
			return;
		}
		?>

		<figure class="elementor-godam-audio">
			<audio controls <?php echo esc_attr( $autoplay ); ?> <?php echo esc_attr( $loop ); ?> preload="<?php echo esc_attr( $preload ); ?>">
				<?php foreach ( $sources as $source ) : ?>
					<source src="<?php echo esc_url( $source['src'] ); ?>" type="<?php echo esc_attr( $source['type'] ); ?>" />
				<?php endforeach; ?>

				<?php esc_html_e( 'Your browser does not support the audio element.', 'godam' ); ?>
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
