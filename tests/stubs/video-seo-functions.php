<?php
/**
 * Narrow WordPress and SEO-plugin stubs for the video SEO schema and video
 * sitemap unit tests (VideoSeoSchemaTest, VideoSitemapTest).
 *
 * Everything reads from `$GLOBALS['rtgodam_stub']`, which each test resets.
 * The fake Yoast SEO / Rank Math classes only exist so the sitemap's noindex
 * checks can be driven per case; no other test touches them.
 *
 * @package GoDAM
 */

// phpcs:disable Universal.Namespaces.DisallowCurlyBraceSyntax.Forbidden, Universal.Namespaces.DisallowDeclarationWithoutName.Forbidden, Universal.Files.SeparateFunctionsFromOO.Mixed, Universal.Namespaces.OneDeclarationPerFile.MultipleFound, Generic.Files.OneObjectStructurePerFile.MultipleFound, WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound, Generic.CodeAnalysis.UnusedFunctionParameter.Found, Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed -- test stubs mirroring WP / third-party APIs.

namespace {

	// get_shortcode_regex(), used by the strip_shortcodes() stub below.
	require_once __DIR__ . '/shortcode-functions.php';

	/*
	 * The HLS URL is read through rtgodam_get_hls_transcoded_url_from_attachment()
	 * when admin/godam-transcoder-functions.php is loaded (EarlyTranslationHooksTest
	 * loads it first in a full run), or straight from the
	 * `rtgodam_hls_transcoded_url` meta otherwise. rtgodam_stub_hls_url() sets
	 * up both the attachment fixture and the meta, so either path gives the same
	 * answer — which is why that function is deliberately NOT stubbed here.
	 */

	if ( ! function_exists( 'rtgodam_stub_hls_url' ) ) {

		/**
		 * Give attachments an HLS URL.
		 *
		 * @param string $url            HLS URL (shared: get_post_meta() is single-post in these stubs).
		 * @param int[]  $attachment_ids Attachment IDs to register as attachments.
		 * @return void
		 */
		function rtgodam_stub_hls_url( $url, array $attachment_ids ) {
			foreach ( $attachment_ids as $attachment_id ) {
				$GLOBALS['rtgodam_stub']['posts'][ $attachment_id ] = new WP_Post(
					array(
						'ID'        => $attachment_id,
						'post_type' => 'attachment',
					)
				);
			}
			$GLOBALS['rtgodam_stub']['post_meta']['rtgodam_hls_transcoded_url'] = $url;
		}
	}

	if ( ! function_exists( 'esc_url_raw' ) ) {

		/**
		 * @param string $url URL.
		 * @return string
		 */
		function esc_url_raw( $url ) {
			return (string) $url;
		}
	}

	if ( ! class_exists( 'WP_Post' ) ) {

		/**
		 * Minimal WP_Post, so code that checks `instanceof WP_Post` (e.g.
		 * rtgodam_get_hls_transcoded_url_from_attachment()) accepts fixtures.
		 */
		#[\AllowDynamicProperties]
		class WP_Post {
 // phpcs:ignore Generic.Classes.DuplicateClassName.Found -- test stub.

			/**
			 * Parent post ID; 0 (unattached) unless a fixture sets it, as in WordPress.
			 *
			 * @var int
			 */
			public $post_parent = 0;

			/**
			 * @param array $props Properties.
			 */
			public function __construct( array $props = array() ) {
				foreach ( $props as $key => $value ) {
					$this->$key = $value;
				}
			}
		}
	}

	if ( ! function_exists( 'get_post' ) ) {

		/**
		 * @param int $post_id Post ID.
		 * @return object|null Post from $GLOBALS['rtgodam_stub']['posts'][ $post_id ].
		 */
		function get_post( $post_id = 0 ) {
			return $GLOBALS['rtgodam_stub']['posts'][ (int) $post_id ] ?? null;
		}
	}

	if ( ! function_exists( 'is_post_publicly_viewable' ) ) {

		/**
		 * Published posts are viewable; a post stub without a status counts as published.
		 *
		 * @param WP_Post|object $post Post.
		 * @return bool
		 */
		function is_post_publicly_viewable( $post = null ) {
			return is_object( $post ) && 'publish' === ( $post->post_status ?? 'publish' );
		}
	}

	if ( ! function_exists( 'get_post_type' ) ) {

		/**
		 * @param int $post_id Post ID.
		 * @return string|false
		 */
		function get_post_type( $post_id = 0 ) {
			$post = get_post( $post_id );
			return $post ? $post->post_type : false;
		}
	}

	if ( ! function_exists( 'has_excerpt' ) ) {

		/**
		 * @param object $post Post.
		 * @return bool
		 */
		function has_excerpt( $post = 0 ) {
			return is_object( $post ) && '' !== (string) $post->post_excerpt;
		}
	}

	/*
	 * Registered shortcodes. Core fills $shortcode_tags as plugins call
	 * add_shortcode(); strip_shortcodes() below only removes tags found in it,
	 * which is the behaviour the sitemap description depends on. These are the
	 * shortcodes core registers itself, plus GoDAM's. A test that needs another
	 * set assigns $GLOBALS['shortcode_tags'] and restores it in tearDown().
	 */
	if ( ! isset( $GLOBALS['shortcode_tags'] ) ) {
		$GLOBALS['shortcode_tags'] = array_fill_keys(
			array( 'wp_caption', 'caption', 'gallery', 'playlist', 'audio', 'video', 'embed', 'godam_video' ),
			'__return_empty_string'
		);
	}

	if ( ! function_exists( 'strip_shortcode_tag' ) ) {

		/**
		 * WordPress core's strip_shortcode_tag(), copied.
		 *
		 * @param array $m Regex match.
		 * @return string
		 */
		function strip_shortcode_tag( $m ) {
			// Allow [[foo]] syntax for escaping a tag.
			if ( '[' === $m[1] && ']' === $m[6] ) {
				return substr( $m[0], 1, -1 );
			}

			return $m[1] . $m[6];
		}
	}

	if ( ! function_exists( 'strip_shortcodes' ) ) {

		/**
		 * WordPress core's strip_shortcodes(): removes the registered shortcodes
		 * found in $content, together with the text they enclose, and leaves
		 * every other [tag] as plain text. Copied from wp-includes/shortcodes.php
		 * except for do_shortcodes_in_html_tags() / unescape_invalid_shortcodes(),
		 * which only matter for shortcodes inside HTML attributes.
		 *
		 * @param string $content Content.
		 * @return string
		 */
		function strip_shortcodes( $content ) {
			global $shortcode_tags;

			$content = (string) $content;

			if ( false === strpos( $content, '[' ) ) {
				return $content;
			}

			if ( empty( $shortcode_tags ) || ! is_array( $shortcode_tags ) ) {
				return $content;
			}

			// Find all tag names in $content.
			preg_match_all( '@\[([^<>&/\[\]\x00-\x20=]++)@', $content, $matches );

			$tags_to_remove = apply_filters( 'strip_shortcodes_tagnames', array_keys( $shortcode_tags ), $content );
			$tagnames       = array_intersect( $tags_to_remove, $matches[1] );

			if ( empty( $tagnames ) ) {
				return $content;
			}

			$pattern = get_shortcode_regex( $tagnames );

			return preg_replace_callback( "/$pattern/", 'strip_shortcode_tag', $content );
		}
	}

	if ( ! function_exists( 'trailingslashit' ) ) {

		/**
		 * @param string $value Path or URL.
		 * @return string
		 */
		function trailingslashit( $value ) {
			return rtrim( (string) $value, '/\\' ) . '/';
		}
	}

	if ( ! function_exists( 'wp_safe_remote_get' ) ) {

		/**
		 * Records the URL and returns $GLOBALS['rtgodam_stub']['http'].
		 *
		 * @param string $url  URL.
		 * @param array  $args Ignored.
		 * @return array
		 */
		function wp_safe_remote_get( $url, $args = array() ) {
			$GLOBALS['rtgodam_stub']['remote_get_urls'][] = $url;
			return $GLOBALS['rtgodam_stub']['http'] ?? array(
				'code' => 404,
				'body' => '',
			);
		}
	}

	if ( ! function_exists( 'update_post_meta' ) ) {

		/**
		 * Records the write into $GLOBALS['rtgodam_stub']['post_meta'].
		 *
		 * @param int    $post_id Post ID.
		 * @param string $key     Meta key.
		 * @param mixed  $value   Value.
		 * @return bool
		 */
		function update_post_meta( $post_id, $key, $value ) {
			$GLOBALS['rtgodam_stub']['post_meta'][ $key ]   = $value;
			$GLOBALS['rtgodam_stub']['meta_writes'][ $key ] = $value;
			return true;
		}
	}

	if ( ! function_exists( 'get_permalink' ) ) {

		/**
		 * Same shape as tests/stubs/product-lookup-functions.php's get_permalink()
		 * (default "shop" site), so results match whichever stub loads first.
		 *
		 * @param int $post Post ID.
		 * @return string
		 */
		function get_permalink( $post = 0 ) {
			return 'https://shop.test/?p=' . (int) $post;
		}
	}

	if ( ! function_exists( 'update_option' ) ) {

		/**
		 * Writes into $GLOBALS['rtgodam_stub']['options'], which the get_option() stub reads.
		 *
		 * @param string $option   Option name.
		 * @param mixed  $value    Value.
		 * @param mixed  $autoload Ignored.
		 * @return bool
		 */
		function update_option( $option, $value, $autoload = null ) {
			$GLOBALS['rtgodam_stub']['options'][ $option ] = $value;
			return true;
		}
	}

	if ( ! function_exists( 'wp_next_scheduled' ) ) {

		/**
		 * @param string $hook Hook.
		 * @param array  $args Args.
		 * @return int|false
		 */
		function wp_next_scheduled( $hook, $args = array() ) {
			foreach ( $GLOBALS['rtgodam_stub']['scheduled'] ?? array() as $event ) {
				if ( $event['hook'] === $hook && $event['args'] === $args ) {
					return $event['timestamp'];
				}
			}
			return false;
		}
	}

	if ( ! function_exists( 'wp_schedule_single_event' ) ) {

		/**
		 * Records the event in $GLOBALS['rtgodam_stub']['scheduled'].
		 *
		 * @param int    $timestamp Timestamp.
		 * @param string $hook      Hook.
		 * @param array  $args      Args.
		 * @return bool
		 */
		function wp_schedule_single_event( $timestamp, $hook, $args = array() ) {
			$GLOBALS['rtgodam_stub']['scheduled'][] = array(
				'timestamp' => $timestamp,
				'hook'      => $hook,
				'args'      => $args,
			);
			return true;
		}
	}

	if ( ! function_exists( 'did_action' ) ) {

		/**
		 * @param string $hook Hook.
		 * @return int
		 */
		function did_action( $hook ) {
			return (int) ( $GLOBALS['rtgodam_stub']['did_action'][ $hook ] ?? 0 );
		}
	}

	if ( ! function_exists( 'metadata_exists' ) ) {

		/**
		 * True when $GLOBALS['rtgodam_stub']['meta_exists'][ $object_id ][ $meta_key ] is set.
		 *
		 * @param string $meta_type Ignored.
		 * @param int    $object_id Object ID.
		 * @param string $meta_key  Meta key.
		 * @return bool
		 */
		function metadata_exists( $meta_type, $object_id, $meta_key ) {
			return ! empty( $GLOBALS['rtgodam_stub']['meta_exists'][ (int) $object_id ][ $meta_key ] );
		}
	}

	if ( ! function_exists( 'get_the_post_thumbnail_url' ) ) {

		/**
		 * @param int    $post_id Post ID.
		 * @param string $size    Ignored.
		 * @return string|false
		 */
		function get_the_post_thumbnail_url( $post_id = 0, $size = 'post-thumbnail' ) {
			return $GLOBALS['rtgodam_stub']['featured_image'][ (int) $post_id ] ?? false;
		}
	}

	if ( ! function_exists( 'get_post_types' ) ) {

		/**
		 * @param array $args Ignored.
		 * @return string[]
		 */
		function get_post_types( $args = array() ) {
			return $GLOBALS['rtgodam_stub']['post_types'] ?? array(
				'post'       => 'post',
				'page'       => 'page',
				'attachment' => 'attachment',
			);
		}
	}

	if ( ! class_exists( 'WP_Sitemaps_Provider' ) ) {

		/**
		 * Minimal core sitemap provider base, for Video_Sitemap_Core_Provider.
		 */
		abstract class WP_Sitemaps_Provider {
 // phpcs:ignore Generic.Classes.DuplicateClassName.Found -- test stub.

			/**
			 * @var string
			 */
			protected $name = '';

			/**
			 * @var string
			 */
			protected $object_type = '';

			/**
			 * @param int    $page_num       Page.
			 * @param string $object_subtype Subtype.
			 * @return array
			 */
			abstract public function get_url_list( $page_num, $object_subtype = '' );

			/**
			 * @param string $object_subtype Subtype.
			 * @return int
			 */
			abstract public function get_max_num_pages( $object_subtype = '' );
		}
	}

	if ( ! class_exists( 'WPSEO_Meta' ) ) {

		/**
		 * Fake Yoast SEO meta API.
		 */
		class WPSEO_Meta {

			/**
			 * @param string $key     Meta key without prefix.
			 * @param int    $post_id Post ID.
			 * @return string
			 */
			public static function get_value( $key, $post_id = 0 ) {
				return (string) ( $GLOBALS['rtgodam_stub']['yoast_meta'][ (int) $post_id ][ $key ] ?? '' );
			}
		}
	}

	if ( ! class_exists( 'WPSEO_Options' ) ) {

		/**
		 * Fake Yoast SEO options API.
		 */
		class WPSEO_Options {

			/**
			 * @param string $key           Option key.
			 * @param mixed  $default_value Default.
			 * @return mixed
			 */
			public static function get( $key, $default_value = null ) {
				return $GLOBALS['rtgodam_stub']['yoast_options'][ $key ] ?? $default_value;
			}
		}
	}
}

namespace RankMath {

	if ( ! class_exists( '\RankMath\Helper' ) ) {

		/**
		 * Fake Rank Math helper.
		 */
		class Helper {

			/**
			 * @param int  $post_id                    Post ID.
			 * @param bool $should_check_excluded_list Ignored.
			 * @return bool
			 */
			public static function is_post_indexable( $post_id, $should_check_excluded_list = true ) {
				return ! in_array( (int) $post_id, $GLOBALS['rtgodam_stub']['rank_math_noindex'] ?? array(), true );
			}

			/**
			 * @param string $module Module slug.
			 * @return bool
			 */
			public static function is_module_active( $module ) {
				return ! empty( $GLOBALS['rtgodam_stub']['rank_math_active'] );
			}
		}
	}
}
