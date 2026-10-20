<?php
/**
 * WordPress core sitemap provider that lists the GoDAM video sitemap in
 * /wp-sitemap.xml when no supported SEO plugin's sitemap is active.
 *
 * Core's sitemap renderer only supports <loc>, <lastmod>, <changefreq> and
 * <priority>, so it cannot output <video:video> elements itself. This
 * provider therefore points the index entries at GoDAM's own video sitemap
 * ({@see Video_Sitemap}) instead of core's /wp-sitemap-{name}-{n}.xml URLs.
 *
 * Only loaded from the `wp_sitemaps_init` action, when WP_Sitemaps_Provider exists.
 *
 * @package GoDAM
 * @since   2.5.0
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

/**
 * Class Video_Sitemap_Core_Provider
 */
class Video_Sitemap_Core_Provider extends \WP_Sitemaps_Provider {

	/**
	 * Video sitemap instance.
	 *
	 * @var Video_Sitemap
	 */
	private $video_sitemap;

	/**
	 * Constructor.
	 *
	 * @param Video_Sitemap $video_sitemap Video sitemap instance.
	 */
	public function __construct( Video_Sitemap $video_sitemap ) {
		$this->name          = Video_Sitemap::CORE_PROVIDER_NAME;
		$this->object_type   = Video_Sitemap::CORE_PROVIDER_NAME;
		$this->video_sitemap = $video_sitemap;
	}

	/**
	 * Point each index entry at GoDAM's own video sitemap page.
	 *
	 * @param string $name Object subtype name (unused).
	 * @param int    $page Page of results.
	 * @return string
	 */
	public function get_sitemap_url( $name, $page ) {
		unset( $name );
		return Video_Sitemap::get_sitemap_url( $page );
	}

	/**
	 * Index entries for /wp-sitemap.xml.
	 *
	 * Overrides core's default (one entry per page from 1 to the page count)
	 * so pages that end up empty — every post on them noindexed, or all their
	 * videos excluded or invalid — aren't listed, matching the Yoast, Rank
	 * Math and AIOSEO indexes ({@see Video_Sitemap::get_index_items()}).
	 *
	 * @return array[] Entries, each with a 'loc' key.
	 */
	public function get_sitemap_entries() {
		$entries = array();

		foreach ( $this->video_sitemap->get_index_items() as $item ) {
			$entry = array( 'loc' => $item['loc'] );

			/** This filter is documented in wp-includes/sitemaps/class-wp-sitemaps-provider.php */
			$entries[] = apply_filters( 'wp_sitemaps_index_entry', $entry, $this->object_type, '', $item['page'] ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- WordPress core's own sitemap filter, applied the same way core does.
		}

		return $entries;
	}

	/**
	 * Plain URL list, only used if core's own /wp-sitemap-godamvideo-{n}.xml
	 * URL is requested directly. The index never links there.
	 *
	 * @param int    $page_num       Page of results.
	 * @param string $object_subtype Unused.
	 * @return array[]
	 */
	public function get_url_list( $page_num, $object_subtype = '' ) {
		unset( $object_subtype );

		$list = array();
		foreach ( $this->video_sitemap->get_url_entries( $page_num ) as $entry ) {
			$list[] = array( 'loc' => $entry['loc'] );
		}

		return $list;
	}

	/**
	 * Number of video sitemap pages.
	 *
	 * @param string $object_subtype Unused.
	 * @return int
	 */
	public function get_max_num_pages( $object_subtype = '' ) {
		unset( $object_subtype );
		return $this->video_sitemap->get_max_pages();
	}
}
