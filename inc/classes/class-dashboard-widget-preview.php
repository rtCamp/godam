<?php
/**
 * Sample data for previewing the GoDAM Dashboard widget.
 *
 * A fresh local site has no uploads and no plays, so every state of the widget
 * would look empty. On sites with WP_DEBUG on, admins can add
 * `?godam-widget-preview=<state>` to wp-admin/index.php to render a state with
 * sample numbers. Outside WP_DEBUG, or for anyone but an admin, it does nothing.
 * Previews apply each tile's floor to the sample numbers and remember nothing.
 *
 * States: active, milestone (active plus the review ask), attention, light (a
 * small site that clears only some floors), no-plays, unavailable, setting-up,
 * library-first (a large library without an API key) and not-connected (an
 * empty site without an API key).
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Enums\Api_Key_Status;
use RTGODAM\Inc\REST_API\Dashboard_Widget_Summary;

/**
 * Class Dashboard_Widget_Preview.
 */
class Dashboard_Widget_Preview {

	/**
	 * Query argument that selects a preview state.
	 *
	 * @var string
	 */
	const QUERY_ARG = 'godam-widget-preview';

	/**
	 * Preview states.
	 *
	 * @var string[]
	 */
	const STATES = array( 'active', 'milestone', 'attention', 'light', 'no-plays', 'unavailable', 'setting-up', 'library-first', 'not-connected' );

	/**
	 * Previews are for local development only.
	 *
	 * @return bool
	 */
	public static function is_allowed() {
		return defined( 'WP_DEBUG' ) && WP_DEBUG && current_user_can( 'manage_options' );
	}

	/**
	 * Keep only known states.
	 *
	 * @param mixed $state Requested state.
	 * @return string The state, or '' when unknown.
	 */
	public static function sanitize_state( $state ) {
		$state = is_string( $state ) ? strtolower( trim( $state ) ) : '';

		return in_array( $state, self::STATES, true ) ? $state : '';
	}

	/**
	 * The preview state requested on this page load, if previews are allowed.
	 *
	 * @return string
	 */
	public static function get_requested() {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only, WP_DEBUG-only display switch.
		if ( ! isset( $_GET[ self::QUERY_ARG ] ) || ! self::is_allowed() ) {
			return '';
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only, WP_DEBUG-only display switch.
		return self::sanitize_state( sanitize_text_field( wp_unslash( $_GET[ self::QUERY_ARG ] ) ) );
	}

	/**
	 * Sample local model for a state, shaped like Dashboard_Widget::get_model().
	 *
	 * @param string $state A preview state.
	 * @return array
	 */
	public static function local_model( $state ) {
		$key_status    = Api_Key_Status::VALID;
		$widget_state  = 'active';
		$counts        = self::counts( 48, 31, 64, 0, 1 );
		$library       = self::library( 402, 58, 44, 96, 12, 71, 540, 18, 431, 29 );
		$video_seconds = 75240;
		$usage         = array(
			'storage_used'    => 18.3,
			'total_storage'   => 50,
			'bandwidth_used'  => 41.7,
			'total_bandwidth' => 100,
		);

		switch ( $state ) {
			case 'attention':
				$counts                  = self::counts( 48, 31, 64, 3, 1 );
				$usage['storage_used']   = 43.1;
				$usage['bandwidth_used'] = 104.2;
				break;
			case 'light':
				$counts        = self::counts( 12, 0, 2, 0, 0 );
				$library       = self::library( 24, 12, 0, 2, 0, 0, 0, 0, 27, 9 );
				$video_seconds = 2880;
				$usage         = array(
					'storage_used'    => 3.1,
					'total_storage'   => 50,
					'bandwidth_used'  => 4.6,
					'total_bandwidth' => 100,
				);
				break;
			case 'no-plays':
				$counts        = self::counts( 2, 0, 0, 0, 0 );
				$library       = self::library( 10, 2, 0, 2, 0, 1, 0, 0, null, 0 );
				$video_seconds = 540;
				$usage         = array(
					'storage_used'    => 0.4,
					'total_storage'   => 50,
					'bandwidth_used'  => 0,
					'total_bandwidth' => 100,
				);
				break;
			case 'setting-up':
				$widget_state  = 'setting_up';
				$counts        = self::counts( 0, 0, 0, 0, 1 );
				$library       = self::library( 180, 3, 0, 29, 0, 22, 0, 0, 164, 0 );
				$video_seconds = 1260;
				break;
			case 'library-first':
				$key_status    = Api_Key_Status::NO_API_KEY;
				$widget_state  = 'not_connected';
				$counts        = self::counts( 0, 0, 0, 0, 0 );
				$library       = self::library( 1980, 48, 92, 190, 0, 150, 1204, 36, 918, 0 );
				$video_seconds = 23400;
				$usage         = array();
				break;
			case 'not-connected':
				$key_status    = Api_Key_Status::NO_API_KEY;
				$widget_state  = 'not_connected';
				$counts        = self::counts( 0, 0, 0, 0, 0 );
				$library       = self::library( 0, 0, 0, 0, 0, 0, 0, 0, null, 0 );
				$video_seconds = 0;
				$usage         = array();
				break;
		}

		$values = Dashboard_Widget::local_values( $library, $counts, $video_seconds );
		$remote = 'active' === $widget_state
			? Dashboard_Widget_Summary::add_visible_tiles( self::summary( $state ), array() )['summary']
			: array();

		return array(
			'state'          => $widget_state,
			'api_key_status' => $key_status,
			'can_manage'     => true,
			'counts'         => $counts,
			'usage'          => $usage,
			'attention'      => Dashboard_Widget::build_attention_items( $key_status, $counts, $usage, true ),
			// Only the milestone preview asks, so the other previews show the widget as most visits will.
			'review_ask'     => 'milestone' === $state,
			'values'         => $values,
			'types'          => $library['types'],
			'show'           => Dashboard_Widget::visible_tiles( $values, array() )['show'],
			// Placeholders for exactly the Watching tiles the sample summary will fill.
			'remote_seen'    => $remote['show'] ?? array(),
			'connect'        => Dashboard_Widget::pick_connect_prompt( $library['types'] ),
		);
	}

	/**
	 * Sample summary for a state, shaped like the summary endpoint's response.
	 *
	 * @param string $state A preview state.
	 * @return array
	 */
	public static function summary( $state ) {
		if ( 'unavailable' === $state ) {
			return array(
				'status'     => 'error',
				'errorType'  => 'microservice_error',
				'fetched_at' => time(),
			);
		}

		if ( 'no-plays' === $state ) {
			return Dashboard_Widget_Summary::shape_summary(
				array(
					'play_time'      => 0,
					'plays'          => 0,
					'unique_viewers' => 0,
					'page_load'      => 0,
					'country_views'  => array(),
				),
				array(),
				time(),
				Dashboard_Widget_Summary::shape_history( array(), time(), Dashboard_Widget_Summary::HISTORY_DAYS )
			);
		}

		if ( 'light' === $state ) {
			return Dashboard_Widget_Summary::shape_summary(
				array(
					'play_time'      => 11520,
					'plays'          => 61,
					'unique_viewers' => 57,
					'page_load'      => 412,
					'country_views'  => array(
						'US' => 1,
						'CA' => 1,
					),
				),
				array(
					array(
						'video_id'  => 201,
						'title'     => 'Kitchen remodel tour',
						'plays'     => 14,
						'play_time' => 2310,
					),
					array(
						'video_id'  => 202,
						'title'     => 'Meet the team',
						'plays'     => 6,
						'play_time' => 540,
					),
				),
				time() - 3 * MINUTE_IN_SECONDS,
				Dashboard_Widget_Summary::shape_history(
					array(
						array(
							'date'  => gmdate( 'Y-m-d', time() - 2 * DAY_IN_SECONDS ),
							'plays' => 5,
						),
						array(
							'date'  => gmdate( 'Y-m-d', time() - 9 * DAY_IN_SECONDS ),
							'plays' => 8,
						),
						array(
							'date'  => gmdate( 'Y-m-d', time() - 17 * DAY_IN_SECONDS ),
							'plays' => 4,
						),
					),
					time(),
					Dashboard_Widget_Summary::HISTORY_DAYS
				)
			);
		}

		$countries = array( 'US', 'IN', 'GB', 'CA', 'AU', 'DE', 'FR', 'NL', 'BR', 'ES', 'IT', 'SE', 'IE', 'SG', 'ZA', 'NZ', 'MX', 'JP', 'PL', 'PT', 'AE', 'PH', 'NG' );

		return Dashboard_Widget_Summary::shape_summary(
			array(
				'play_time'      => 187560,
				'plays'          => 3412,
				'unique_viewers' => 2286,
				'page_load'      => 9870,
				'country_views'  => array_fill_keys( $countries, 1 ),
			),
			array(
				array(
					'video_id'  => 101,
					'title'     => 'Onboarding walkthrough',
					'plays'     => 812,
					'play_time' => 51120,
				),
				array(
					'video_id'  => 102,
					'title'     => 'Spring product launch',
					'plays'     => 604,
					'play_time' => 38016,
				),
				array(
					'video_id'  => 103,
					'title'     => 'How to reset your password',
					'plays'     => 377,
					'play_time' => 9048,
				),
			),
			time() - 6 * MINUTE_IN_SECONDS,
			self::sample_history()
		);
	}

	/**
	 * Sample processing counts, shaped like Dashboard_Widget::summarize_status_rows().
	 *
	 * @param int $videos     Videos ready to stream.
	 * @param int $audio      Audio files ready to stream.
	 * @param int $documents  Documents ready to preview.
	 * @param int $failed     Files that failed.
	 * @param int $processing Files in progress.
	 * @return array
	 */
	private static function counts( $videos, $audio, $documents, $failed, $processing ) {
		$transcoded = $videos + $audio + $documents;

		return array(
			'videos_ready'    => $videos,
			'audio_ready'     => $audio,
			'documents_ready' => $documents,
			'transcoded'      => $transcoded,
			'failed'          => $failed,
			'processing'      => $processing,
			'total'           => $transcoded + $failed + $processing,
		);
	}

	/**
	 * Sample library counts, shaped like the widget's Media Library counts.
	 *
	 * @param int      $images       Images.
	 * @param int      $videos       Videos.
	 * @param int      $audio        Audio files.
	 * @param int      $documents    Documents, office files included.
	 * @param int      $other        Other files.
	 * @param int      $office       The Word, Excel and PowerPoint part of $documents.
	 * @param int      $folder_files Files in a folder.
	 * @param int      $folders      Folders.
	 * @param int|null $in_use       Files in use, or null while the usage scan runs.
	 * @param int      $captions     Videos with a transcript.
	 * @return array
	 */
	private static function library( $images, $videos, $audio, $documents, $other, $office, $folder_files, $folders, $in_use, $captions ) {
		return array(
			'types'        => array(
				'images'    => $images,
				'videos'    => $videos,
				'audio'     => $audio,
				'documents' => $documents,
				'other'     => $other,
				'office'    => $office,
			),
			'folder_files' => $folder_files,
			'folders'      => $folders,
			'files_in_use' => $in_use,
			'captions'     => $captions,
		);
	}

	/**
	 * A month of sample plays: a steady rhythm with a weekly bump, the same on every load.
	 *
	 * @return array[] From Dashboard_Widget_Summary::shape_history().
	 */
	private static function sample_history() {
		$rows = array();
		for ( $offset = 0; $offset < Dashboard_Widget_Summary::HISTORY_DAYS; $offset++ ) {
			$rows[] = array(
				'date'  => gmdate( 'Y-m-d', time() - $offset * DAY_IN_SECONDS ),
				'plays' => max( 0, (int) round( 34 + 12 * sin( $offset / 2.3 ) + ( 0 === $offset % 7 ? 16 : 0 ) ) ),
			);
		}

		return Dashboard_Widget_Summary::shape_history( $rows, time(), Dashboard_Widget_Summary::HISTORY_DAYS );
	}
}
