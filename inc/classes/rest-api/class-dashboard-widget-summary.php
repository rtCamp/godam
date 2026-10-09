<?php
/**
 * REST endpoints behind the GoDAM Dashboard widget.
 *
 * `summary` returns the remote half of the widget in one call: lifetime watch
 * time, plays, viewers, countries and times shown for this site, plus plays per
 * day and the top three videos for the last 30 days, and which of those the
 * widget shows (see Dashboard_Widget::visible_tiles()). It reuses the Analytics
 * proxy handlers and caches the analytics numbers for 15 minutes, the interval
 * at which godam-analytics re-aggregates, so the cache costs no freshness.
 * `review-ask` saves an admin's answer to the widget's review ask.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

use WP_REST_Server;
use WP_REST_Request;
use WP_REST_Response;
use RTGODAM\Inc\Dashboard_Widget;
use RTGODAM\Inc\Dashboard_Widget_Preview;

/**
 * Class Dashboard_Widget_Summary.
 */
class Dashboard_Widget_Summary extends Base {

	/**
	 * REST route base.
	 *
	 * @var string
	 */
	protected $rest_base = 'dashboard-widget';

	/**
	 * Transient prefix for cached summaries, one per site origin.
	 *
	 * @var string
	 */
	const CACHE_PREFIX = 'rtgodam_dw_summary_v2_';

	/**
	 * How long a successful summary is cached.
	 *
	 * @var int
	 */
	const CACHE_TTL = 15 * MINUTE_IN_SECONDS;

	/**
	 * How long a failed summary is cached, so an outage is not retried on every load.
	 *
	 * @var int
	 */
	const ERROR_CACHE_TTL = 2 * MINUTE_IN_SECONDS;

	/**
	 * Days covered by the top videos list.
	 *
	 * @var int
	 */
	const TOP_VIDEOS_DAYS = 30;

	/**
	 * Days covered by the plays chart.
	 *
	 * @var int
	 */
	const HISTORY_DAYS = 30;

	/**
	 * Register the summary and review-ask routes.
	 *
	 * @return array
	 */
	public function get_rest_routes() {
		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/summary',
				'args'      => array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_summary' ),
					'permission_callback' => array( $this, 'check_permission' ),
					'args'                => array(
						'preview' => array(
							'required'          => false,
							'type'              => 'string',
							'sanitize_callback' => 'sanitize_text_field',
						),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/review-ask',
				'args'      => array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'save_review_choice' ),
					'permission_callback' => array( $this, 'check_manage_permission' ),
					'args'                => array(
						'choice' => array(
							'required' => true,
							'type'     => 'string',
							'enum'     => array( 'review', 'later', 'never' ),
						),
					),
				),
			),
		);
	}

	/**
	 * Same audience as the widget and the analytics routes: authors and above.
	 *
	 * @return bool
	 */
	public function check_permission() {
		return current_user_can( 'upload_files' );
	}

	/**
	 * Only admins are asked for a review, so only admins can answer.
	 *
	 * @return bool
	 */
	public function check_manage_permission() {
		return current_user_can( 'manage_options' );
	}

	/**
	 * Save the site's answer to the review ask.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response
	 */
	public function save_review_choice( WP_REST_Request $request ) {
		update_option(
			Dashboard_Widget::REVIEW_OPTION,
			Dashboard_Widget::review_choice_record( $request->get_param( 'choice' ), time() ),
			false
		);

		return new WP_REST_Response( array( 'status' => 'success' ), 200 );
	}

	/**
	 * Return the widget summary, from cache when fresh.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response
	 */
	public function get_summary( WP_REST_Request $request ) {
		// The preview class is not in the release zip (.distignore).
		$preview = class_exists( Dashboard_Widget_Preview::class ) ? Dashboard_Widget_Preview::sanitize_state( $request->get_param( 'preview' ) ) : '';
		if ( $preview && Dashboard_Widget_Preview::is_allowed() ) {
			// Preview shows each tile on its own numbers and remembers nothing.
			return new WP_REST_Response( self::add_visible_tiles( Dashboard_Widget_Preview::summary( $preview ), array() )['summary'], 200 );
		}

		// This site's own origin, never a caller-supplied URL.
		$site_url  = self::get_site_origin( home_url() );
		$cache_key = self::CACHE_PREFIX . md5( $site_url );
		$summary   = get_transient( $cache_key );

		if ( ! is_array( $summary ) ) {
			$summary = $this->build_summary( $site_url );
			// A summary with a part missing is retried as soon as a failed one.
			$complete = 'success' === $summary['status'] && empty( $summary['unavailable'] );
			set_transient( $cache_key, $summary, $complete ? self::CACHE_TTL : self::ERROR_CACHE_TTL );
		}

		// Worked out per request, not cached: the tiles shown before live in an option.
		$seen   = get_option( Dashboard_Widget::SEEN_OPTION, array() );
		$seen   = is_array( $seen ) ? $seen : array();
		$result = self::add_visible_tiles( $summary, $seen );

		if ( $result['seen'] !== $seen ) {
			update_option( Dashboard_Widget::SEEN_OPTION, $result['seen'], false );
		}

		return new WP_REST_Response( $result['summary'], 200 );
	}

	/**
	 * Add the list of Watching tiles to show to a successful summary.
	 *
	 * @param array    $summary From shape_summary(), or an error.
	 * @param string[] $seen    Tiles shown before.
	 * @return array With 'summary' (with 'show' added on success) and 'seen' (the updated list).
	 */
	public static function add_visible_tiles( array $summary, array $seen ) {
		if ( 'success' !== ( $summary['status'] ?? '' ) ) {
			return array(
				'summary' => $summary,
				'seen'    => $seen,
			);
		}

		$tiles           = Dashboard_Widget::visible_tiles( Dashboard_Widget::remote_values( $summary ), $seen );
		$summary['show'] = $tiles['show'];

		return array(
			'summary' => $summary,
			'seen'    => $tiles['seen'],
		);
	}

	/**
	 * Fetch lifetime metrics, top videos and history through the Analytics proxy handlers.
	 *
	 * @param string $site_url This site's origin.
	 * @return array From assemble_summary().
	 */
	private function build_summary( $site_url ) {
		$analytics = Analytics::get_instance();

		$metrics_request = new WP_REST_Request( 'GET', '/godam/v1/analytics/dashboard-metrics' );
		$metrics_request->set_param( 'site_url', $site_url );
		$metrics = $analytics->fetch_dashboard_metrics( $metrics_request )->get_data();

		if ( ! is_array( $metrics ) || 'success' !== ( $metrics['status'] ?? '' ) ) {
			return self::assemble_summary( $metrics, null, null, time() );
		}

		$top_request = new WP_REST_Request( 'GET', '/godam/v1/analytics/top-videos' );
		$top_request->set_param( 'site_url', $site_url );
		$top_request->set_param( 'page', 1 );
		$top_request->set_param( 'limit', 3 );
		$top_request->set_param( 'start_date', gmdate( 'Y-m-d', time() - ( self::TOP_VIDEOS_DAYS - 1 ) * DAY_IN_SECONDS ) );
		$top_request->set_param( 'end_date', gmdate( 'Y-m-d' ) );
		// Like the GoDAM Dashboard: a deleted video is not a top video.
		$top_request->set_param( 'hide_deleted', true );
		$top = $analytics->fetch_top_videos( $top_request )->get_data();

		$history_request = new WP_REST_Request( 'GET', '/godam/v1/analytics/dashboard-history' );
		$history_request->set_param( 'site_url', $site_url );
		$history_request->set_param( 'days', self::HISTORY_DAYS );
		$history = $analytics->fetch_dashboard_history( $history_request )->get_data();

		return self::assemble_summary( $metrics, $top, $history, time() );
	}

	/**
	 * Combine the three proxy responses into the summary.
	 *
	 * A failed metrics call fails the whole summary. A failed top-videos or
	 * history call only marks that part as unavailable, so the script hides it
	 * instead of showing "0 plays", and the summary is cached for the short
	 * error TTL.
	 *
	 * @param mixed $metrics `dashboard-metrics` response data.
	 * @param mixed $top     `top-videos` response data, or null when not fetched.
	 * @param mixed $history `dashboard-history` response data, or null when not fetched.
	 * @param int   $now     Unix time of the fetch.
	 * @return array
	 */
	public static function assemble_summary( $metrics, $top, $history, $now ) {
		if ( ! is_array( $metrics ) || 'success' !== ( $metrics['status'] ?? '' ) ) {
			return array(
				'status'     => 'error',
				'errorType'  => is_array( $metrics ) ? ( $metrics['errorType'] ?? 'microservice_error' ) : 'microservice_error',
				'fetched_at' => (int) $now,
			);
		}

		$unavailable = array();

		$top_ok = is_array( $top ) && 'success' === ( $top['status'] ?? '' ) && is_array( $top['top_videos'] ?? null );
		if ( ! $top_ok ) {
			$unavailable[] = 'top_videos';
		}

		$history_ok = is_array( $history ) && 'success' === ( $history['status'] ?? '' ) && is_array( $history['dashboard_metrics_history'] ?? null );
		if ( ! $history_ok ) {
			$unavailable[] = 'history';
		}

		$summary = self::shape_summary(
			is_array( $metrics['dashboard_metrics'] ?? null ) ? $metrics['dashboard_metrics'] : array(),
			$top_ok ? $top['top_videos'] : array(),
			$now,
			$history_ok ? self::shape_history( $history['dashboard_metrics_history'], $now, self::HISTORY_DAYS ) : array()
		);

		$summary['unavailable'] = $unavailable;

		return $summary;
	}

	/**
	 * Plays per day for the last $days days, oldest first, with quiet days as zero.
	 *
	 * The analytics service returns only days that had activity, newest first,
	 * with dates as UTC `Y-m-d`.
	 *
	 * @param array $rows  `dashboard_metrics_history` rows from the dashboard-history proxy.
	 * @param int   $today Unix time inside the last day of the window.
	 * @param int   $days  Days in the window.
	 * @return array[] Rows of array( 'date' => 'Y-m-d', 'plays' => int ).
	 */
	public static function shape_history( array $rows, $today, $days ) {
		$plays = array();
		foreach ( $rows as $row ) {
			if ( ! is_array( $row ) || empty( $row['date'] ) ) {
				continue;
			}

			$date           = substr( (string) $row['date'], 0, 10 );
			$plays[ $date ] = ( $plays[ $date ] ?? 0 ) + max( 0, (int) ( $row['plays'] ?? 0 ) );
		}

		$series = array();
		for ( $offset = $days - 1; $offset >= 0; $offset-- ) {
			$date     = gmdate( 'Y-m-d', (int) $today - $offset * DAY_IN_SECONDS );
			$series[] = array(
				'date'  => $date,
				'plays' => $plays[ $date ] ?? 0,
			);
		}

		return $series;
	}

	/**
	 * Shape analytics responses into what the widget shows.
	 *
	 * @param array $metrics    `dashboard_metrics` from the dashboard-metrics proxy (all-time).
	 * @param array $top_videos `top_videos` from the top-videos proxy.
	 * @param int   $fetched_at Unix time the numbers were fetched.
	 * @param array $history    Plays per day, from shape_history().
	 * @return array
	 */
	public static function shape_summary( array $metrics, array $top_videos, $fetched_at, array $history = array() ) {
		$countries = 0;
		if ( isset( $metrics['country_views'] ) && is_array( $metrics['country_views'] ) ) {
			$countries = count( array_filter( $metrics['country_views'] ) );
		}

		$videos = array();
		foreach ( $top_videos as $video ) {
			if ( count( $videos ) >= 3 ) {
				break;
			}
			if ( ! is_array( $video ) || empty( $video['video_id'] ) ) {
				continue;
			}

			$id       = (int) $video['video_id'];
			$videos[] = array(
				'id'            => $id,
				// get_the_title() output is HTML-encoded; the script sets textContent.
				'title'         => html_entity_decode( wp_strip_all_tags( (string) ( $video['title'] ?? '' ) ), ENT_QUOTES, 'UTF-8' ),
				'plays'         => max( 0, (int) ( $video['plays'] ?? 0 ) ),
				'watch_seconds' => max( 0.0, (float) ( $video['play_time'] ?? 0 ) ),
				'url'           => 'admin.php?page=rtgodam_analytics&id=' . $id,
			);
		}

		return array(
			'status'     => 'success',
			'receipts'   => array(
				'watch_seconds'  => max( 0.0, (float) ( $metrics['play_time'] ?? 0 ) ),
				'plays'          => max( 0, (int) ( $metrics['plays'] ?? 0 ) ),
				'unique_viewers' => max( 0, (int) ( $metrics['unique_viewers'] ?? 0 ) ),
				'countries'      => $countries,
				// Times a video came into view on a page (at least 10% visible), played or not.
				'times_shown'    => max( 0, (int) ( $metrics['page_load'] ?? 0 ) ),
			),
			'top_videos' => $videos,
			'history'    => array_values( $history ),
			'fetched_at' => (int) $fetched_at,
		);
	}

	/**
	 * Reduce a URL to its origin (scheme, host and port), the form analytics records.
	 *
	 * @param string $url Any URL on the site, usually home_url().
	 * @return string The origin, or '' when the URL has no host.
	 */
	public static function get_site_origin( $url ) {
		$parts = wp_parse_url( (string) $url );
		if ( empty( $parts['host'] ) ) {
			return '';
		}

		$origin = ( $parts['scheme'] ?? 'https' ) . '://' . $parts['host'];
		if ( ! empty( $parts['port'] ) ) {
			$origin .= ':' . $parts['port'];
		}

		return $origin;
	}
}
