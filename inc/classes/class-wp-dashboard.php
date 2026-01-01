<?php
/**
 * GoDAM WP dashboard class.
 *
 * @package godam
 */

namespace RTGODAM\Inc;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class WP_Dashboard
 */
class WP_Dashboard {

	use Singleton;

	/**
	 * Construct method.
	 */
	protected function __construct() {
		add_action( 'wp_dashboard_setup', array( $this, 'godam_register_wp_dashboard_widget' ) );
	}

	public function godam_register_wp_dashboard_widget() {
		wp_add_dashboard_widget(
			'godam_dashboard_widget',
			esc_html__( 'GoDAM Overview', 'godam' ),
			array( $this, 'godam_render_dashboard_widget' )
		);
	}

	public function godam_render_dashboard_widget() {
		?>
		<div class="godam-dashboard-widget">
			<h3><?php esc_html_e( 'Welcome to GoDAM!', 'godam' ); ?></h3>
			<p><?php esc_html_e( 'Manage your digital assets efficiently with GoDAM.', 'godam' ); ?></p>
			<ul>
				<li><a href="<?php echo esc_url( admin_url( 'admin.php?page=godam-assets' ) ); ?>"><?php esc_html_e( 'View Assets', 'godam' ); ?></a></li>
				<li><a href="<?php echo esc_url( admin_url( 'admin.php?page=godam-settings' ) ); ?>"><?php esc_html_e( 'GoDAM Settings', 'godam' ); ?></a></li>
				<li><a href="https://docs.godamplugin.com" target="_blank"><?php esc_html_e( 'Documentation', 'godam' ); ?></a></li>
			</ul>
		</div>
		<?php
	}
}
