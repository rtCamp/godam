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
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_dashboard_widget_assets' ) );
	}

	/**
	 * Register the GoDAM dashboard widget.
	 *
	 * @return void
	 */
	public function godam_register_wp_dashboard_widget() {
		wp_add_dashboard_widget(
			'godam_dashboard_widget',
			esc_html__( 'GoDAM Overview', 'godam' ),
			array( $this, 'godam_render_dashboard_widget' )
		);
	}

	/**
	 * Enqueue styles and scripts for the dashboard widget.
	 *
	 * @param string $hook_suffix The current admin page hook suffix.
	 *
	 * @return void
	 */
	public function enqueue_dashboard_widget_assets( $hook_suffix ) {
		if ( 'index.php' !== $hook_suffix ) {
			return;
		}

		wp_enqueue_script(
			'godam-wp-dashboard-widget',
			RTGODAM_URL . 'assets/build/js/godam-dashboard-widget.min.js',
			array( 'jquery', 'wp-api-fetch' ),
			RTGODAM_VERSION,
			true
		);

		wp_localize_script(
			'godam-wp-dashboard-widget',
			'godamDashboardWidget',
			array(
				'restUrl' => get_rest_url( get_current_blog_id() ),
				'nonce'   => wp_create_nonce( 'wp_rest' ),
				'siteUrl' => get_home_url(),
			)
		);
	}

	/**
	 * Render the GoDAM dashboard widget HTML shell.
	 * Data is populated via JS after REST API calls.
	 *
	 * @return void
	 */
	public function godam_render_dashboard_widget() {
		?>
		<div class="godam-dashboard-widget" id="godam-dashboard-widget">

			<!-- Loading State -->
			<div class="godam-dw-loading" id="godam-dw-loading">
				<p><?php esc_html_e( 'Loading analytics…', 'godam' ); ?></p>
			</div>

			<!-- Error State -->
			<div class="godam-dw-error" id="godam-dw-error" style="display:none;">
				<p id="godam-dw-error-message"></p>
			</div>

			<!-- Content (hidden until data is loaded) -->
			<div class="godam-dw-content" id="godam-dw-content" style="display:none;">

				<!-- Metrics Cards -->
				<div class="godam-dw-metrics">
					<div class="godam-dw-metric-card">
						<span class="godam-dw-metric-label"><?php esc_html_e( 'Total Plays', 'godam' ); ?></span>
						<span class="godam-dw-metric-value" id="godam-dw-plays">0</span>
					</div>
					<div class="godam-dw-metric-card">
						<span class="godam-dw-metric-label"><?php esc_html_e( 'Watch Time', 'godam' ); ?></span>
						<span class="godam-dw-metric-value" id="godam-dw-watch-time">0s</span>
					</div>
					<div class="godam-dw-metric-card">
						<span class="godam-dw-metric-label"><?php esc_html_e( 'Play Rate', 'godam' ); ?></span>
						<span class="godam-dw-metric-value" id="godam-dw-play-rate">0%</span>
					</div>
					<div class="godam-dw-metric-card">
						<span class="godam-dw-metric-label"><?php esc_html_e( 'Avg Engagement', 'godam' ); ?></span>
						<span class="godam-dw-metric-value" id="godam-dw-avg-engagement">0%</span>
					</div>
					<div class="godam-dw-metric-card">
						<span class="godam-dw-metric-label"><?php esc_html_e( 'Active Videos', 'godam' ); ?></span>
						<span class="godam-dw-metric-value" id="godam-dw-total-videos">0</span>
					</div>
				</div>

				<!-- Sparkline Chart (last 60 days plays) -->
				<div class="godam-dw-chart-section">
					<h4><?php esc_html_e( 'Plays (Last 60 Days)', 'godam' ); ?></h4>
					<canvas id="godam-dw-sparkline" width="100%" height="60"></canvas>
				</div>

				<!-- Top Videos -->
				<div class="godam-dw-top-videos-section">
					<h4><?php esc_html_e( 'Top Videos', 'godam' ); ?></h4>
					<table class="godam-dw-top-videos-table widefat striped">
						<thead>
							<tr>
								<th><?php esc_html_e( 'Video', 'godam' ); ?></th>
								<th><?php esc_html_e( 'Plays', 'godam' ); ?></th>
								<th><?php esc_html_e( 'Watch Time', 'godam' ); ?></th>
							</tr>
						</thead>
						<tbody id="godam-dw-top-videos-body">
							<tr>
								<td colspan="3"><?php esc_html_e( 'No videos found.', 'godam' ); ?></td>
							</tr>
						</tbody>
					</table>
				</div>

				<!-- Quick Links -->
				<div class="godam-dw-quick-links">
					<a href="<?php echo esc_url( admin_url( 'admin.php?page=rtgodam' ) ); ?>" class="button button-primary">
						<?php esc_html_e( 'Dashboard', 'godam' ); ?>
					</a>
					<a href="<?php echo esc_url( admin_url( 'admin.php?page=rtgodam_analytics' ) ); ?>" class="button">
						<?php esc_html_e( 'Analytics', 'godam' ); ?>
					</a>
					<a href="<?php echo esc_url( admin_url( 'admin.php?page=rtgodam_settings' ) ); ?>" class="button">
						<?php esc_html_e( 'Settings', 'godam' ); ?>
					</a>
					<a href="https://godam.io/docs/overview/" target="_blank" class="button">
						<?php esc_html_e( 'Documentation', 'godam' ); ?>
					</a>
				</div>
			</div>
		</div>
		<?php
	}
}
