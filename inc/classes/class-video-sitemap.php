<?php
/**
 * Video sitemap for pages that contain GoDAM videos.
 *
 * Lists one <url> per published page that contains GoDAM videos, with one
 * <video:video> per video. The data comes from the video SEO post meta that
 * {@see Seo} already saves for each page, so the sitemap and the page's
 * VideoObject schema always agree. No new public URLs are created: only pages
 * that already exist are listed.
 *
 * The sitemap is served by GoDAM itself at /godam-video-sitemap.xml (pages 2+
 * at /godam-video-sitemap2.xml, …) and listed in the active SEO plugin's
 * sitemap index — Yoast SEO, Rank Math or All in One SEO — or, when none of
 * those is active, in the WordPress core sitemap index (/wp-sitemap.xml).
 *
 * @package GoDAM
 * @since   2.5.0
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Video_Sitemap
 */
class Video_Sitemap {

	use Singleton;

	/**
	 * Sitemap file slug. Page 1 is `{slug}.xml`, page n is `{slug}{n}.xml`.
	 */
	const SLUG = 'godam-video-sitemap';

	/**
	 * Query var used to serve the sitemap on sites with plain permalinks.
	 */
	const QUERY_VAR = 'godam_video_sitemap';

	/**
	 * Name of the WordPress core sitemap provider (lowercase letters only).
	 */
	const CORE_PROVIDER_NAME = 'godamvideo';

	/**
	 * Option holding the cache version. Bumping it invalidates every cached page.
	 */
	const CACHE_VERSION_OPTION = 'godam_video_sitemap_cache_version';

	/**
	 * Default number of <url> entries per sitemap page.
	 */
	const DEFAULT_ENTRIES_PER_PAGE = 1000;

	/**
	 * Google's limits for <video:description> and <video:duration>.
	 */
	const MAX_DESCRIPTION_LENGTH = 2048;
	const MAX_TITLE_LENGTH       = 100;
	const MAX_DURATION_SECONDS   = 28800;

	/**
	 * Construct method.
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * Setup hooks.
	 *
	 * Cache invalidation is always wired up (it's cheap), so turning the
	 * sitemap on never serves stale data. Everything else only runs when the
	 * sitemap is enabled.
	 *
	 * @return void
	 */
	protected function setup_hooks() {
		add_action( 'godam_video_seo_schema_saved', array( $this, 'invalidate_cache' ) );
		add_action( 'godam_video_seo_schema_cleared', array( $this, 'maybe_invalidate_on_cleared' ), 10, 2 );
		add_action( 'transition_post_status', array( $this, 'maybe_invalidate_on_status_change' ), 10, 3 );
		add_action( 'before_delete_post', array( $this, 'maybe_invalidate_on_delete' ) );
		add_action( 'edit_attachment', array( $this, 'maybe_invalidate_on_attachment_edit' ) );

		// Values the sitemap resolves live from the attachment (HLS URL, original
		// file, transcript excerpt) can change without the attachment being
		// "edited" — e.g. the transcoding callback writes the HLS URL directly.
		add_action( 'added_post_meta', array( $this, 'maybe_invalidate_on_attachment_meta' ), 10, 3 );
		add_action( 'updated_post_meta', array( $this, 'maybe_invalidate_on_attachment_meta' ), 10, 3 );
		add_action( 'deleted_post_meta', array( $this, 'maybe_invalidate_on_attachment_meta' ), 10, 3 );

		add_action( 'add_option_rtgodam-settings', array( $this, 'maybe_invalidate_on_settings_add' ), 10, 2 );
		add_action( 'update_option_rtgodam-settings', array( $this, 'maybe_invalidate_on_settings_update' ), 10, 2 );

		// The plugin loads while godam.php is included, before the theme and any
		// plugin loaded after GoDAM have added their filters. Decide whether the
		// sitemap is on at after_setup_theme, so `godam_video_sitemap_enabled`
		// works from a theme's functions.php or any plugin, and still before
		// `init` / `wp_sitemaps_init`.
		if ( did_action( 'after_setup_theme' ) ) {
			$this->register_sitemap_hooks();
		} else {
			add_action( 'after_setup_theme', array( $this, 'register_sitemap_hooks' ), 20 );
		}
	}

	/**
	 * Register the hooks that serve and list the sitemap, when it's enabled.
	 *
	 * @return void
	 */
	public function register_sitemap_hooks() {
		if ( ! self::is_enabled() ) {
			return;
		}

		add_filter( 'query_vars', array( $this, 'add_query_var' ) );

		// Also list the sitemap in robots.txt, so search engines find it on
		// sites whose SEO plugin GoDAM doesn't integrate with, or with core
		// sitemaps turned off.
		add_filter( 'robots_txt', array( $this, 'add_robots_txt_sitemap' ), 20, 2 ); // phpcs:ignore WordPressVIPMinimum.Hooks.RestrictedHooks.robots_txt -- core builds robots.txt on each request; nothing to flush outside VIP.

		// Priority 1: before All in One SEO (parse_request), Rank Math
		// (parse_query), Yoast (pre_get_posts) and core (template_redirect)
		// try to handle a "*-sitemap.xml" URL themselves.
		add_action( 'parse_request', array( $this, 'maybe_serve_sitemap' ), 1 );

		// List the sitemap in whichever SEO plugin's index is active.
		add_filter( 'wpseo_sitemap_index_links', array( $this, 'add_yoast_index_links' ) );
		add_filter( 'rank_math/sitemap/index', array( $this, 'add_rank_math_index_entries' ) );
		add_filter( 'aioseo_sitemap_indexes', array( $this, 'add_aioseo_index_entries' ) );
		add_action( 'wp_sitemaps_init', array( $this, 'register_core_provider' ) );
	}

	/**
	 * Whether the video sitemap is turned on under GoDAM > Settings > SEO.
	 *
	 * Off by default.
	 *
	 * @return bool
	 */
	public static function is_enabled() {
		$settings = get_option( 'rtgodam-settings', array() );
		$enabled  = is_array( $settings ) && ! empty( $settings['seo']['enable_video_sitemap'] );

		/**
		 * Filters whether the GoDAM video sitemap is enabled.
		 *
		 * @since 2.5.0
		 *
		 * @param bool $enabled Whether the sitemap is enabled in settings.
		 */
		return (bool) apply_filters( 'godam_video_sitemap_enabled', $enabled );
	}

	/**
	 * Number of <url> entries per sitemap page.
	 *
	 * @return int
	 */
	public static function get_entries_per_page() {
		/**
		 * Filters the number of pages listed per video sitemap file.
		 *
		 * @since 2.5.0
		 *
		 * @param int $entries Entries per sitemap page. Default 1000.
		 */
		$entries = (int) apply_filters( 'godam_video_sitemap_entries_per_page', self::DEFAULT_ENTRIES_PER_PAGE );

		return max( 1, min( 50000, $entries ) );
	}

	/**
	 * Public URL of a sitemap page.
	 *
	 * @param int $page 1-based page number.
	 * @return string
	 */
	public static function get_sitemap_url( $page = 1 ) {
		$page = max( 1, (int) $page );

		if ( ! get_option( 'permalink_structure' ) ) {
			return add_query_arg( array( self::QUERY_VAR => $page ), home_url( '/' ) );
		}

		return home_url( '/' . self::SLUG . ( $page > 1 ? $page : '' ) . '.xml' );
	}

	/**
	 * Register the plain-permalink query var.
	 *
	 * @param array $vars Public query vars.
	 * @return array
	 */
	public function add_query_var( $vars ) {
		$vars[] = self::QUERY_VAR;
		return $vars;
	}

	/**
	 * Serve the sitemap when it is requested.
	 *
	 * @param \WP $wp Current WordPress environment instance.
	 * @return void
	 */
	public function maybe_serve_sitemap( $wp ) {
		$page = self::get_requested_page( $wp );
		if ( null === $page ) {
			return;
		}

		$this->render( $page );
		exit;
	}

	/**
	 * Work out which sitemap page (if any) the request is for.
	 *
	 * @param \WP $wp Current WordPress environment instance.
	 * @return int|null 1-based page number, or null when the request isn't for the sitemap.
	 */
	public static function get_requested_page( $wp ) {
		if ( isset( $wp->query_vars[ self::QUERY_VAR ] ) && '' !== $wp->query_vars[ self::QUERY_VAR ] ) {
			return max( 1, absint( $wp->query_vars[ self::QUERY_VAR ] ) );
		}

		$request = isset( $wp->request ) ? (string) $wp->request : '';

		return self::parse_page_from_path( $request );
	}

	/**
	 * Parse a request path like "godam-video-sitemap.xml" or
	 * "godam-video-sitemap3.xml".
	 *
	 * @param string $path Request path relative to the home URL.
	 * @return int|null Page number, or null when the path isn't the sitemap.
	 */
	public static function parse_page_from_path( $path ) {
		$path = trim( (string) $path, '/' );

		if ( ! preg_match( '#^' . preg_quote( self::SLUG, '#' ) . '([0-9]*)\.xml$#', $path, $matches ) ) {
			return null;
		}

		if ( '' === $matches[1] ) {
			return 1;
		}

		$page = (int) $matches[1];

		// "-sitemap0.xml" / "-sitemap1.xml" aren't canonical; treat them as page 1.
		return max( 1, $page );
	}

	/**
	 * Output one sitemap page and the right headers.
	 *
	 * @param int $page 1-based page number.
	 * @return void
	 */
	public function render( $page ) {
		$max_pages = $this->get_max_pages();

		if ( $page > max( 1, $max_pages ) ) {
			status_header( 404 );
			nocache_headers();
			header( 'Content-Type: text/plain; charset=UTF-8' );
			echo 'Not found.';
			return;
		}

		$xml = $this->get_page_xml( $page );

		status_header( 200 );
		header( 'Content-Type: application/xml; charset=UTF-8' );
		header( 'X-Robots-Tag: noindex, follow', true );
		echo $xml; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- XML built by build_urlset_xml(), every value escaped there.
	}

	/**
	 * Get (cached) sitemap XML for one page.
	 *
	 * @param int $page 1-based page number.
	 * @return string
	 */
	public function get_page_xml( $page ) {
		return $this->get_page_data( $page )['xml'];
	}

	/**
	 * Number of <url> entries a sitemap page actually contains, after noindexed
	 * pages, excluded videos and invalid videos are dropped.
	 *
	 * @param int $page 1-based page number.
	 * @return int
	 */
	public function get_page_url_count( $page ) {
		return $this->get_page_data( $page )['count'];
	}

	/**
	 * Build (or read from cache) one sitemap page's XML and its entry count.
	 *
	 * @param int $page 1-based page number.
	 * @return array{xml:string,count:int}
	 */
	private function get_page_data( $page ) {
		$cache_key = $this->get_cache_key( 'page_' . (int) $page );
		$cached    = get_transient( $cache_key );

		if ( is_array( $cached ) && isset( $cached['xml'], $cached['count'] ) && is_string( $cached['xml'] ) ) {
			return array(
				'xml'   => $cached['xml'],
				'count' => (int) $cached['count'],
			);
		}

		$entries = $this->get_url_entries( $page );
		$data    = array(
			'xml'   => self::build_urlset_xml( $entries ),
			'count' => count( $entries ),
		);

		set_transient( $cache_key, $data, DAY_IN_SECONDS );

		return $data;
	}

	/**
	 * Build the <url> entries for one sitemap page.
	 *
	 * @param int $page 1-based page number.
	 * @return array[] Entries for {@see self::build_urlset_xml()}.
	 */
	public function get_url_entries( $page ) {
		$post_ids = $this->query_post_ids( $page );
		$entries  = array();
		$seo      = Seo::get_instance();

		foreach ( $post_ids as $post_id ) {
			if ( $this->is_post_excluded( $post_id ) ) {
				continue;
			}

			$cached = $this->get_cached_videos( $post_id );
			if ( empty( $cached ) ) {
				continue;
			}

			$videos = array();
			$seen   = array();

			foreach ( $cached as $video ) {
				if ( ! is_array( $video ) || empty( $video['headline'] ) ) {
					continue;
				}

				// Per-video "Exclude from video sitemap" toggle.
				if ( ! empty( $video['excludeFromSitemap'] ) ) {
					continue;
				}

				$schema = $seo->build_video_object_schema( $video, $post_id );
				if ( empty( $schema ) || ! is_array( $schema ) ) {
					continue;
				}

				$video_entry = $this->schema_to_sitemap_video( $schema, $post_id );
				if ( null === $video_entry ) {
					continue;
				}

				// The same video placed twice on one page is listed once.
				$dedupe_key = ! empty( $video['attachment_id'] )
					? 'a:' . (int) $video['attachment_id']
					: 'u:' . ( $video_entry['content_loc'] ?? '' ) . '|' . ( $video_entry['player_loc'] ?? '' ) . '|' . $video_entry['title'];
				if ( isset( $seen[ $dedupe_key ] ) ) {
					continue;
				}
				$seen[ $dedupe_key ] = true;

				$videos[] = $video_entry;
			}

			if ( empty( $videos ) ) {
				continue;
			}

			$entry = array(
				'loc'     => $this->get_post_url( $post_id ),
				'lastmod' => $this->get_post_lastmod( $post_id ),
				'videos'  => $videos,
			);

			/**
			 * Filters a single page entry in the GoDAM video sitemap.
			 *
			 * Return an empty value to drop the page from the sitemap.
			 *
			 * @since 2.5.0
			 *
			 * @param array $entry   Entry with 'loc', 'lastmod' and 'videos'.
			 * @param int   $post_id Host post ID.
			 */
			$entry = apply_filters( 'godam_video_sitemap_entry', $entry, $post_id );

			if ( ! empty( $entry['loc'] ) && ! empty( $entry['videos'] ) ) {
				$entries[] = $entry;
			}
		}

		return $entries;
	}

	/**
	 * Cached video SEO entries saved for a page by {@see Seo}.
	 *
	 * @param int $post_id Host post ID.
	 * @return array[]
	 */
	protected function get_cached_videos( $post_id ) {
		$cached = get_post_meta( $post_id, Seo::VIDEO_SEO_SCHEMA_META_KEY, true ); // godam-coverage-ignore -- get_cached_videos(): $post_id is a host page from query_post_ids(), never an attachment; reads its own cached SEO meta.

		return is_array( $cached ) ? $cached : array();
	}

	/**
	 * Permalink of a listed page.
	 *
	 * @param int $post_id Host post ID.
	 * @return string
	 */
	protected function get_post_url( $post_id ) {
		return (string) get_permalink( $post_id );
	}

	/**
	 * Last-modified date of a listed page.
	 *
	 * @param int $post_id Host post ID.
	 * @return string W3C date, or ''.
	 */
	protected function get_post_lastmod( $post_id ) {
		$post = get_post( $post_id ); // godam-coverage-ignore -- get_post_lastmod(): host page, never an attachment.

		return $post ? self::format_gmt_date( $post->post_modified_gmt ) : '';
	}

	/**
	 * Map a VideoObject schema array to the fields of a <video:video> element.
	 *
	 * @param array $schema  VideoObject schema from Seo::build_video_object_schema().
	 * @param int   $post_id Host post ID, used for a thumbnail fallback.
	 * @return array|null Sitemap video fields, or null when a required field is missing.
	 */
	public function schema_to_sitemap_video( array $schema, $post_id ) {
		$thumbnail = ! empty( $schema['thumbnailUrl'] ) ? (string) $schema['thumbnailUrl'] : '';
		if ( '' === $thumbnail && $post_id ) {
			$thumbnail = (string) get_the_post_thumbnail_url( $post_id, 'full' );
		}

		$title = ! empty( $schema['name'] ) ? (string) $schema['name'] : '';

		// <video:description> is required by Google; the schema leaves it out
		// when there's nothing to say, so fall back to the title here.
		$description = ! empty( $schema['description'] ) ? (string) $schema['description'] : $title;

		$video = array(
			'thumbnail_loc'    => $thumbnail,
			'title'            => Seo::trim_to_length( $title, self::MAX_TITLE_LENGTH ),
			'description'      => Seo::trim_to_length( $description, self::MAX_DESCRIPTION_LENGTH ),
			'content_loc'      => ! empty( $schema['contentUrl'] ) ? (string) $schema['contentUrl'] : '',
			'player_loc'       => ! empty( $schema['embedUrl'] ) ? (string) $schema['embedUrl'] : '',
			'duration'         => ! empty( $schema['duration'] ) ? self::iso8601_duration_to_seconds( $schema['duration'] ) : 0,
			'publication_date' => ! empty( $schema['uploadDate'] ) ? (string) $schema['uploadDate'] : '',
			'family_friendly'  => ! isset( $schema['isFamilyFriendly'] ) || (bool) $schema['isFamilyFriendly'],
		);

		return self::is_valid_video( $video ) ? $video : null;
	}

	/**
	 * Whether a sitemap video has every field Google requires: a thumbnail,
	 * title, description, and a content or player location.
	 *
	 * @param array $video Sitemap video fields.
	 * @return bool
	 */
	public static function is_valid_video( array $video ) {
		return ! empty( $video['thumbnail_loc'] )
			&& ! empty( $video['title'] )
			&& ! empty( $video['description'] )
			&& ( ! empty( $video['content_loc'] ) || ! empty( $video['player_loc'] ) );
	}

	/**
	 * Convert an ISO 8601 duration (e.g. "PT1H2M3S") to whole seconds.
	 *
	 * @param string $duration ISO 8601 duration.
	 * @return int Seconds, or 0 when unparseable.
	 */
	public static function iso8601_duration_to_seconds( $duration ) {
		return Seo::iso8601_to_seconds( $duration );
	}

	/**
	 * Build a complete video sitemap <urlset> document.
	 *
	 * Pure: no WordPress calls, every value escaped here.
	 *
	 * @param array[] $entries Each with 'loc', optional 'lastmod', and 'videos'
	 *                         (each with the keys from schema_to_sitemap_video()).
	 * @return string XML document.
	 */
	public static function build_urlset_xml( array $entries ) {
		$xml  = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
		$xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">' . "\n";

		foreach ( $entries as $entry ) {
			if ( empty( $entry['loc'] ) || empty( $entry['videos'] ) || ! is_array( $entry['videos'] ) ) {
				continue;
			}

			$xml .= "\t<url>\n";
			$xml .= "\t\t<loc>" . self::xml_escape( $entry['loc'] ) . "</loc>\n";

			if ( ! empty( $entry['lastmod'] ) ) {
				$xml .= "\t\t<lastmod>" . self::xml_escape( $entry['lastmod'] ) . "</lastmod>\n";
			}

			foreach ( $entry['videos'] as $video ) {
				if ( ! is_array( $video ) || ! self::is_valid_video( $video ) ) {
					continue;
				}

				$xml .= "\t\t<video:video>\n";
				$xml .= "\t\t\t<video:thumbnail_loc>" . self::xml_escape( $video['thumbnail_loc'] ) . "</video:thumbnail_loc>\n";
				$xml .= "\t\t\t<video:title>" . self::xml_escape( $video['title'] ) . "</video:title>\n";
				$xml .= "\t\t\t<video:description>" . self::xml_escape( $video['description'] ) . "</video:description>\n";

				if ( ! empty( $video['content_loc'] ) ) {
					$xml .= "\t\t\t<video:content_loc>" . self::xml_escape( $video['content_loc'] ) . "</video:content_loc>\n";
				}
				if ( ! empty( $video['player_loc'] ) ) {
					$xml .= "\t\t\t<video:player_loc>" . self::xml_escape( $video['player_loc'] ) . "</video:player_loc>\n";
				}

				$duration = isset( $video['duration'] ) ? (int) $video['duration'] : 0;
				if ( $duration >= 1 && $duration <= self::MAX_DURATION_SECONDS ) {
					$xml .= "\t\t\t<video:duration>" . $duration . "</video:duration>\n";
				}

				if ( ! empty( $video['publication_date'] ) ) {
					$xml .= "\t\t\t<video:publication_date>" . self::xml_escape( $video['publication_date'] ) . "</video:publication_date>\n";
				}

				if ( isset( $video['family_friendly'] ) && ! $video['family_friendly'] ) {
					$xml .= "\t\t\t<video:family_friendly>no</video:family_friendly>\n";
				}

				$xml .= "\t\t</video:video>\n";
			}

			$xml .= "\t</url>\n";
		}

		$xml .= '</urlset>' . "\n";

		return $xml;
	}

	/**
	 * Escape a value for XML text content, dropping characters XML 1.0 forbids.
	 *
	 * @param mixed $value Value.
	 * @return string
	 */
	public static function xml_escape( $value ) {
		$value = (string) $value;
		$value = preg_replace( '/[^\x{9}\x{A}\x{D}\x{20}-\x{D7FF}\x{E000}-\x{FFFD}\x{10000}-\x{10FFFF}]/u', '', $value );

		return htmlspecialchars( (string) $value, ENT_XML1 | ENT_QUOTES, 'UTF-8' );
	}

	/**
	 * Post types whose pages can be listed.
	 *
	 * @return string[]
	 */
	public static function get_post_types() {
		$post_types = array_values( array_diff( get_post_types( array( 'public' => true ) ), array( 'attachment' ) ) );

		/**
		 * Filters the post types whose pages may appear in the video sitemap.
		 *
		 * @since 2.5.0
		 *
		 * @param string[] $post_types Public post types, minus attachment.
		 */
		return (array) apply_filters( 'godam_video_sitemap_post_types', $post_types );
	}

	/**
	 * Base query arguments: published, not password-protected pages that have
	 * cached video SEO data. Drafts and private posts are excluded by status.
	 *
	 * @return array
	 */
	public function get_base_query_args() {
		return array(
			'post_type'              => self::get_post_types(),
			'post_status'            => 'publish',
			'has_password'           => false,
			'meta_key'               => Seo::VIDEO_SEO_SCHEMA_META_KEY, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- indexed meta_key existence check; results cached.
			'fields'                 => 'ids',
			'orderby'                => 'ID',
			'order'                  => 'ASC',
			'ignore_sticky_posts'    => true,
			'update_post_term_cache' => false,
		);
	}

	/**
	 * Post IDs for one sitemap page.
	 *
	 * @param int $page 1-based page number.
	 * @return int[]
	 */
	protected function query_post_ids( $page ) {
		$query = new \WP_Query( // godam-coverage-ignore -- queries host pages (public post types, attachment excluded), never attachments.
			array_merge(
				$this->get_base_query_args(),
				array(
					'posts_per_page' => self::get_entries_per_page(),
					'paged'          => max( 1, (int) $page ),
					'no_found_rows'  => true,
				)
			)
		);

		$post_ids = array_map( 'intval', $query->posts );

		// 'fields' => 'ids' skips priming the post and meta caches; do it in one
		// go so building the page doesn't run per-post queries.
		if ( ! empty( $post_ids ) && function_exists( '_prime_post_caches' ) ) {
			_prime_post_caches( $post_ids, false, true );
		}

		return $post_ids;
	}

	/**
	 * Total number of candidate pages (before the noindex check), cached.
	 *
	 * @return int
	 */
	public function get_total_count() {
		$cache_key = $this->get_cache_key( 'count' );
		$cached    = get_transient( $cache_key );

		if ( false !== $cached ) {
			return (int) $cached;
		}

		$query = new \WP_Query( // godam-coverage-ignore -- queries host pages (public post types, attachment excluded), never attachments.
			array_merge(
				$this->get_base_query_args(),
				array(
					'posts_per_page' => 1,
					'paged'          => 1,
				)
			)
		);

		$count = (int) $query->found_posts;
		set_transient( $cache_key, $count, DAY_IN_SECONDS );

		return $count;
	}

	/**
	 * Number of sitemap pages.
	 *
	 * @return int 0 when there's nothing to list.
	 */
	public function get_max_pages() {
		$count = $this->get_total_count();

		return $count > 0 ? (int) ceil( $count / self::get_entries_per_page() ) : 0;
	}

	/**
	 * Most recent modification time of any listed page, for index <lastmod>.
	 *
	 * @return string W3C date, or ''.
	 */
	public function get_last_modified() {
		$cache_key = $this->get_cache_key( 'lastmod' );
		$cached    = get_transient( $cache_key );

		if ( false !== $cached ) {
			return (string) $cached;
		}

		$query = new \WP_Query( // godam-coverage-ignore -- queries host pages (public post types, attachment excluded), never attachments.
			array_merge(
				$this->get_base_query_args(),
				array(
					'posts_per_page' => 1,
					'orderby'        => 'modified',
					'order'          => 'DESC',
					'no_found_rows'  => true,
				)
			)
		);

		$lastmod = '';
		if ( ! empty( $query->posts ) ) {
			$post = get_post( (int) $query->posts[0] ); // godam-coverage-ignore -- get_last_modified(): host page, never an attachment.
			if ( $post ) {
				$lastmod = self::format_gmt_date( $post->post_modified_gmt );
			}
		}

		set_transient( $cache_key, $lastmod, DAY_IN_SECONDS );

		return $lastmod;
	}

	/**
	 * Whether a page must be left out of the sitemap: noindexed by the active
	 * SEO plugin, or excluded by a filter.
	 *
	 * Status (drafts, private) and password protection are already handled by
	 * the query.
	 *
	 * @param int $post_id Host post ID.
	 * @return bool
	 */
	public function is_post_excluded( $post_id ) {
		$excluded = $this->is_post_noindex( $post_id );

		/**
		 * Filters whether a page is left out of the GoDAM video sitemap.
		 *
		 * @since 2.5.0
		 *
		 * @param bool $excluded Whether the page is excluded (true when noindexed).
		 * @param int  $post_id  Host post ID.
		 */
		return (bool) apply_filters( 'godam_video_sitemap_exclude_post', $excluded, $post_id );
	}

	/**
	 * Whether the active SEO plugin marks a page noindex — for the page itself
	 * or through its post type's default.
	 *
	 * @param int $post_id Host post ID.
	 * @return bool
	 */
	public function is_post_noindex( $post_id ) {
		$post_type = get_post_type( $post_id ); // godam-coverage-ignore -- is_post_noindex(): $post_id is a listed host page, never an attachment.

		try {
			// Yoast SEO: '1' = noindex, '2' = index, '' / '0' = post type default.
			if ( class_exists( '\WPSEO_Meta' ) && class_exists( '\WPSEO_Options' ) ) {
				$value = (string) \WPSEO_Meta::get_value( 'meta-robots-noindex', $post_id );
				if ( '1' === $value ) {
					return true;
				}
				if ( '2' !== $value && \WPSEO_Options::get( 'noindex-' . $post_type, false ) ) {
					return true;
				}
			}

			// Rank Math: handles the post meta and the post type default.
			if ( class_exists( '\RankMath\Helper' ) && method_exists( '\RankMath\Helper', 'is_post_indexable' ) ) {
				if ( ! \RankMath\Helper::is_post_indexable( $post_id, false ) ) {
					return true;
				}
			}

			// All in One SEO.
			if ( function_exists( 'aioseo' ) ) {
				$aioseo = aioseo();
				$post   = get_post( $post_id ); // godam-coverage-ignore -- is_post_noindex(): host page, never an attachment.
				if ( $post && isset( $aioseo->meta->metaData ) && method_exists( $aioseo->meta->metaData, 'getMetaData' ) ) {
					$meta = $aioseo->meta->metaData->getMetaData( $post );
					if ( $meta && empty( $meta->robots_default ) && ! empty( $meta->robots_noindex ) ) {
						return true;
					}
					if ( ( ! $meta || ! empty( $meta->robots_default ) ) && isset( $aioseo->helpers ) && method_exists( $aioseo->helpers, 'isPostTypeNoindexed' ) && $aioseo->helpers->isPostTypeNoindexed( $post_type ) ) {
						return true;
					}
				}
			}
		} catch ( \Throwable $e ) {
			// An SEO plugin API changed shape; don't break the sitemap over it.
			unset( $e );
		}

		return false;
	}

	/**
	 * Which SEO plugin's sitemap is active, if any.
	 *
	 * @return string 'yoast', 'rank-math', 'aioseo', or '' for none (core fallback).
	 */
	public static function get_active_seo_sitemap() {
		try {
			if ( defined( 'WPSEO_VERSION' ) && class_exists( '\WPSEO_Options' ) && \WPSEO_Options::get( 'enable_xml_sitemap', true ) ) {
				return 'yoast';
			}

			if ( class_exists( '\RankMath\Helper' ) && method_exists( '\RankMath\Helper', 'is_module_active' ) && \RankMath\Helper::is_module_active( 'sitemap' ) ) {
				return 'rank-math';
			}

			if ( function_exists( 'aioseo' ) ) {
				$aioseo = aioseo();
				if ( isset( $aioseo->options->sitemap->general ) && $aioseo->options->sitemap->general->enable ) {
					return 'aioseo';
				}
			}
		} catch ( \Throwable $e ) {
			unset( $e );
		}

		return '';
	}

	/**
	 * Yoast SEO: add our sitemap pages to sitemap_index.xml.
	 *
	 * @param array $links Index links, each with 'loc' and 'lastmod'.
	 * @return array
	 */
	public function add_yoast_index_links( $links ) {
		$links = is_array( $links ) ? $links : array();

		foreach ( $this->get_index_items() as $item ) {
			$links[] = array(
				'loc'     => $item['loc'],
				'lastmod' => $item['lastmod'],
			);
		}

		return $links;
	}

	/**
	 * Rank Math: append our sitemap pages to sitemap_index.xml.
	 *
	 * @param string $xml Extra index XML.
	 * @return string
	 */
	public function add_rank_math_index_entries( $xml ) {
		$xml = is_string( $xml ) ? $xml : '';

		foreach ( $this->get_index_items() as $item ) {
			$xml .= "\t<sitemap>\n\t\t<loc>" . self::xml_escape( $item['loc'] ) . "</loc>\n";
			if ( '' !== $item['lastmod'] ) {
				$xml .= "\t\t<lastmod>" . self::xml_escape( $item['lastmod'] ) . "</lastmod>\n";
			}
			$xml .= "\t</sitemap>\n";
		}

		return $xml;
	}

	/**
	 * All in One SEO: add our sitemap pages to sitemap.xml.
	 *
	 * @param array $indexes Index entries, each with 'loc', 'lastmod' and 'count'.
	 * @return array
	 */
	public function add_aioseo_index_entries( $indexes ) {
		$indexes = is_array( $indexes ) ? $indexes : array();

		foreach ( $this->get_index_items() as $item ) {
			$indexes[] = array(
				'loc'     => $item['loc'],
				'lastmod' => $item['lastmod'],
				'count'   => $item['count'],
			);
		}

		return $indexes;
	}

	/**
	 * WordPress core sitemaps: register a provider so our sitemap is listed in
	 * /wp-sitemap.xml — only when no supported SEO plugin's sitemap is active.
	 *
	 * @param \WP_Sitemaps $wp_sitemaps Core sitemaps instance.
	 * @return void
	 */
	public function register_core_provider( $wp_sitemaps ) {
		if ( '' !== self::get_active_seo_sitemap() ) {
			return;
		}

		if ( ! class_exists( '\WP_Sitemaps_Provider' ) || ! is_object( $wp_sitemaps ) || ! isset( $wp_sitemaps->registry ) ) {
			return;
		}

		$wp_sitemaps->registry->add_provider( self::CORE_PROVIDER_NAME, new Video_Sitemap_Core_Provider( $this ) );
	}

	/**
	 * One item per sitemap page, for the SEO plugins' indexes.
	 *
	 * @return array[] Each with 'loc', 'lastmod', 'count' and 'page'.
	 */
	public function get_index_items() {
		$max_pages = $this->get_max_pages();
		$lastmod   = $max_pages ? $this->get_last_modified() : '';
		$items     = array();

		for ( $page = 1; $page <= $max_pages; $page++ ) {
			// Pages are sized on candidate posts; noindexed pages and excluded
			// or invalid videos are only dropped while building the page. Don't
			// advertise a page that ends up empty (Search Console flags empty
			// sitemaps), and report the real number of URLs it holds. The page
			// data is cached, so this costs one build per cache version.
			$url_count = $this->get_page_url_count( $page );
			if ( $url_count < 1 ) {
				continue;
			}

			$items[] = array(
				'loc'     => self::get_sitemap_url( $page ),
				'lastmod' => $lastmod,
				'count'   => $url_count,
				'page'    => $page,
			);
		}

		return $items;
	}

	/**
	 * Cache key for a piece of sitemap data, scoped to the current cache version.
	 *
	 * Transients live in each site's own options table, so on multisite every
	 * sub-site keeps its own cache.
	 *
	 * @param string $suffix Key suffix.
	 * @return string
	 */
	private function get_cache_key( $suffix ) {
		$version = (int) get_option( self::CACHE_VERSION_OPTION, 1 );

		return 'godam_vsm_' . $version . '_' . $suffix;
	}

	/**
	 * Invalidate every cached sitemap page by bumping the cache version. Old
	 * transients expire on their own.
	 *
	 * @return void
	 */
	public function invalidate_cache() {
		$version = (int) get_option( self::CACHE_VERSION_OPTION, 1 );
		update_option( self::CACHE_VERSION_OPTION, $version + 1, false );
	}

	/**
	 * Whether an attachment is used by at least one page with cached video SEO.
	 *
	 * @param int $attachment_id Attachment ID.
	 * @return bool
	 */
	private function is_attachment_in_use( $attachment_id ) {
		/**
		 * Fires before reading this attachment's reverse-index meta, so
		 * integrations that centralize media on another site can switch
		 * context first.
		 *
		 * @since 2.5.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );
		$in_use = metadata_exists( 'post', (int) $attachment_id, Seo::ATTACHMENT_POSTS_MAP_META_KEY );
		do_action( 'rtgodam_after_attachment_lookup' );

		return $in_use;
	}

	/**
	 * Invalidate when a post's video SEO is cleared, but only if it had any.
	 *
	 * `godam_video_seo_schema_cleared` fires on every save of a post with no
	 * GoDAM video (pages, products, orders…); those don't affect the sitemap.
	 *
	 * @param int  $post_id    Post ID.
	 * @param bool $had_schema Whether the post had cached video SEO before. Defaults
	 *                         to true for callers that don't pass it.
	 * @return void
	 */
	public function maybe_invalidate_on_cleared( $post_id, $had_schema = true ) {
		unset( $post_id );

		if ( $had_schema ) {
			$this->invalidate_cache();
		}
	}

	/**
	 * Add a `Sitemap:` line for the video sitemap to robots.txt.
	 *
	 * @param string $output    robots.txt content.
	 * @param bool   $is_public Whether the site is public (Settings > Reading).
	 * @return string
	 */
	public function add_robots_txt_sitemap( $output, $is_public ) {
		if ( ! $is_public ) {
			return $output;
		}

		$line = 'Sitemap: ' . esc_url_raw( self::get_sitemap_url( 1 ) );

		if ( false !== strpos( (string) $output, $line ) ) {
			return $output;
		}

		return rtrim( (string) $output ) . "\n" . $line . "\n";
	}

	/**
	 * Whether WordPress core sitemaps (/wp-sitemap.xml) are enabled.
	 *
	 * They're off when "Discourage search engines" is set, or when a plugin
	 * filters `wp_sitemaps_enabled`.
	 *
	 * @return bool
	 */
	public static function are_core_sitemaps_enabled() {
		if ( function_exists( 'wp_sitemaps_get_server' ) ) {
			$server = wp_sitemaps_get_server();
			if ( is_object( $server ) && method_exists( $server, 'sitemaps_enabled' ) ) {
				return (bool) $server->sitemaps_enabled();
			}
		}

		return false;
	}

	/**
	 * Invalidate on `edit_attachment` only for a video that a listed page uses,
	 * not for every media edit (e.g. alt text on an unrelated image).
	 *
	 * The page-level data itself is refreshed by Seo's background re-sync,
	 * which fires `godam_video_seo_schema_saved`; this keeps the sitemap from
	 * serving stale data until that runs.
	 *
	 * @param int $attachment_id Attachment ID.
	 * @return void
	 */
	public function maybe_invalidate_on_attachment_edit( $attachment_id ) {
		/** This action is documented in inc/classes/class-video-sitemap.php */
		do_action( 'rtgodam_before_attachment_lookup' );
		$mime = (string) get_post_mime_type( $attachment_id );
		do_action( 'rtgodam_after_attachment_lookup' );

		if ( 0 !== strpos( $mime, 'video/' ) ) {
			return;
		}

		if ( $this->is_attachment_in_use( $attachment_id ) ) {
			$this->invalidate_cache();
		}
	}

	/**
	 * Invalidate when attachment meta the sitemap reads live changes on a video
	 * that a listed page uses: the HLS URL (written by the transcoding
	 * callback), the original file, or the cached transcript excerpt.
	 *
	 * @param int|int[] $meta_ids  Meta ID(s). Unused.
	 * @param int       $object_id Post ID the meta belongs to.
	 * @param string    $meta_key  Meta key.
	 * @return void
	 */
	public function maybe_invalidate_on_attachment_meta( $meta_ids, $object_id, $meta_key ) {
		unset( $meta_ids );

		$watched = array(
			'rtgodam_hls_transcoded_url',
			'_wp_attached_file',
			Seo::TRANSCRIPT_EXCERPT_META_KEY,
		);

		if ( ! in_array( $meta_key, $watched, true ) ) {
			return;
		}

		if ( $this->is_attachment_in_use( $object_id ) ) {
			$this->invalidate_cache();
		}
	}

	/**
	 * Invalidate when the GoDAM settings option is first created with SEO settings.
	 *
	 * @param string $option Option name. Unused.
	 * @param mixed  $value  New value.
	 * @return void
	 */
	public function maybe_invalidate_on_settings_add( $option, $value ) {
		unset( $option );

		if ( is_array( $value ) && ! empty( $value['seo'] ) ) {
			$this->invalidate_cache();
		}
	}

	/**
	 * Invalidate on a GoDAM settings save only when the SEO settings changed,
	 * not on unrelated saves (player, ads, …).
	 *
	 * @param mixed $old_value Previous value.
	 * @param mixed $value     New value.
	 * @return void
	 */
	public function maybe_invalidate_on_settings_update( $old_value, $value ) {
		$old_seo = ( is_array( $old_value ) && isset( $old_value['seo'] ) ) ? $old_value['seo'] : null;
		$new_seo = ( is_array( $value ) && isset( $value['seo'] ) ) ? $value['seo'] : null;

		if ( $old_seo !== $new_seo ) {
			$this->invalidate_cache();
		}
	}

	/**
	 * Invalidate when a page with videos is published, unpublished, trashed, etc.
	 *
	 * @param string   $new_status New status.
	 * @param string   $old_status Old status.
	 * @param \WP_Post $post       Post.
	 * @return void
	 */
	public function maybe_invalidate_on_status_change( $new_status, $old_status, $post ) {
		if ( $new_status === $old_status || ! $post instanceof \WP_Post || 'attachment' === $post->post_type ) {
			return;
		}

		if ( 'publish' !== $new_status && 'publish' !== $old_status ) {
			return;
		}

		if ( metadata_exists( 'post', $post->ID, Seo::VIDEO_SEO_SCHEMA_META_KEY ) ) {
			$this->invalidate_cache();
		}
	}

	/**
	 * Invalidate when a page with videos, or a video used on a page, is about
	 * to be deleted (its meta still exists at `before_delete_post`).
	 *
	 * @param int $post_id Post ID being deleted.
	 * @return void
	 */
	public function maybe_invalidate_on_delete( $post_id ) {
		if (
			metadata_exists( 'post', $post_id, Seo::VIDEO_SEO_SCHEMA_META_KEY ) ||
			metadata_exists( 'post', $post_id, Seo::ATTACHMENT_POSTS_MAP_META_KEY )
		) {
			$this->invalidate_cache();
		}
	}

	/**
	 * Format a GMT MySQL datetime as a W3C date.
	 *
	 * @param string $gmt_datetime e.g. "2026-10-13 09:30:00".
	 * @return string e.g. "2026-10-13T09:30:00+00:00", or '' when empty/invalid.
	 */
	public static function format_gmt_date( $gmt_datetime ) {
		if ( empty( $gmt_datetime ) || '0000-00-00 00:00:00' === $gmt_datetime ) {
			return '';
		}

		$timestamp = strtotime( $gmt_datetime . ' UTC' );

		return false === $timestamp ? '' : gmdate( DATE_W3C, $timestamp );
	}
}
