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

	if ( ! function_exists( 'strip_shortcodes' ) ) {

		/**
		 * @param string $content Content.
		 * @return string
		 */
		function strip_shortcodes( $content ) {
			return preg_replace( '/\[[^\]]*\]/', '', (string) $content );
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
