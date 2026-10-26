<?php
/**
 * Narrow stubs for the form-plugin REST route tests.
 *
 * The form listing handlers ask each form plugin for its forms, and the Jetpack
 * handlers read the host post's blocks and hand the form to Jetpack's own
 * Contact_Form. These stubs answer from `$GLOBALS['rtgodam_stub']`, so a test
 * sets what the plugin holds and checks what the route returns.
 *
 * Every definition is guarded so a real WP test bootstrap wins.
 *
 * @package GoDAM
 */

// phpcs:disable Universal.Namespaces.DisallowCurlyBraceSyntax.Forbidden, Universal.Namespaces.DisallowDeclarationWithoutName.Forbidden, Universal.Namespaces.OneDeclarationPerFile.MultipleFound, Universal.Files.SeparateFunctionsFromOO.Mixed, Generic.Files.OneObjectStructurePerFile.MultipleFound, Generic.Classes.DuplicateClassName.Found, WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound, Generic.CodeAnalysis.UnusedFunctionParameter.Found, Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed -- test stubs mirroring WP / third-party APIs.

namespace {

	if ( ! class_exists( 'WP_Query' ) ) {

		/**
		 * Answers page 1 with the posts of the queried type, and every later page with none.
		 */
		class WP_Query {

			/**
			 * @var array
			 */
			public $posts = array();

			/**
			 * @param array $args Query args; `post_type` and `paged` are read.
			 */
			public function __construct( $args = array() ) {
				$type = $args['post_type'] ?? 'post';
				if ( 1 === (int) ( $args['paged'] ?? 1 ) ) {
					$this->posts = $GLOBALS['rtgodam_stub']['form_posts'][ $type ] ?? array();
				}
			}
		}
	}

	if ( ! class_exists( 'Forminator_API' ) ) {

		/**
		 * Page 1 holds the forms the test set; later pages are empty.
		 */
		class Forminator_API {

			/**
			 * @param mixed $ids      Ignored.
			 * @param int   $page     Page number.
			 * @param int   $per_page Ignored.
			 * @param mixed $status   Ignored.
			 * @return array
			 */
			public static function get_forms( $ids = null, $page = 1, $per_page = 10, $status = '' ) {
				return 1 === (int) $page ? ( $GLOBALS['rtgodam_stub']['forminator_forms'] ?? array() ) : array();
			}
		}
	}

	if ( ! function_exists( 'rest_ensure_response' ) ) {

		/**
		 * @param mixed $data Response data.
		 * @return mixed The data, or the response/error it already is.
		 */
		function rest_ensure_response( $data ) {
			if ( $data instanceof \WP_Error || $data instanceof \WP_REST_Response ) {
				return $data;
			}
			return new \WP_REST_Response( $data );
		}
	}

	if ( ! function_exists( 'wp_unslash' ) ) {

		/**
		 * @param mixed $value Value.
		 * @return mixed
		 */
		function wp_unslash( $value ) {
			return $value;
		}
	}

	if ( ! function_exists( 'sanitize_key' ) ) {

		/**
		 * @param string $key Key.
		 * @return string
		 */
		function sanitize_key( $key ) {
			return strtolower( preg_replace( '/[^a-zA-Z0-9_\-]/', '', (string) $key ) );
		}
	}

	if ( ! function_exists( 'wp_create_nonce' ) ) {

		/**
		 * @param string $action Nonce action.
		 * @return string
		 */
		function wp_create_nonce( $action = '' ) {
			return 'nonce-' . $action;
		}
	}

	if ( ! function_exists( 'setup_postdata' ) ) {

		/**
		 * @param mixed $post Post.
		 * @return bool
		 */
		function setup_postdata( $post ) {
			return true;
		}
	}

	if ( ! function_exists( 'wp_reset_postdata' ) ) {

		/**
		 * @return void
		 */
		function wp_reset_postdata() {
		}
	}

	if ( ! function_exists( 'parse_blocks' ) ) {

		/**
		 * Treats the post content as the name of one Jetpack form block, so a test
		 * gives a post a form with `post_content` = 'form' and none with ''.
		 *
		 * @param string $content Post content.
		 * @return array
		 */
		function parse_blocks( $content ) {
			if ( 'form' !== $content ) {
				return array();
			}
			return array(
				array(
					'blockName'   => 'jetpack/contact-form',
					'attrs'       => array( 'subject' => 'Hello' ),
					'innerBlocks' => array(),
				),
			);
		}
	}

	if ( ! function_exists( 'render_block' ) ) {

		/**
		 * @param array $block Block.
		 * @return string
		 */
		function render_block( $block ) {
			return '';
		}
	}

	if ( ! class_exists( 'Jetpack' ) ) {

		/**
		 * Present so the routes see Jetpack as active.
		 */
		class Jetpack {}
	}
}

namespace Automattic\Jetpack\Forms\ContactForm {

	if ( ! class_exists( __NAMESPACE__ . '\Contact_Form' ) ) {

		/**
		 * Jetpack's contact form, reduced to what GoDAM's routes call: the forms
		 * registry, the hash and attributes, one name field, and a submission that
		 * is recorded in `$GLOBALS['rtgodam_stub']['jetpack_submissions']`.
		 */
		class Contact_Form {

			/**
			 * @var array
			 */
			public static $forms = array();

			/**
			 * @var string
			 */
			public $hash;

			/**
			 * @var array
			 */
			public $attributes;

			/**
			 * @var array
			 */
			public $fields;

			/**
			 * @param array  $attributes Form attributes.
			 * @param string $content    Form body.
			 */
			public function __construct( $attributes = array(), $content = '' ) {
				$this->attributes = $attributes;
				$this->hash       = md5( 'form-' . ( $attributes['id'] ?? '' ) );
				$this->fields     = array( 'g1-name' => new Contact_Form_Field() );
			}

			/**
			 * @return void
			 */
			public static function style_on() {}

			/**
			 * @param array  $attributes Form attributes.
			 * @param string $content    Form body.
			 * @return string
			 */
			public static function parse( $attributes, $content ) {
				return '<form data-form-id="' . ( $attributes['id'] ?? '' ) . '"></form>';
			}

			/**
			 * @param string $name Attribute name.
			 * @return mixed
			 */
			public function get_attribute( $name ) {
				return $this->attributes[ $name ] ?? '';
			}

			/**
			 * @return bool
			 */
			public function process_submission() {
				$GLOBALS['rtgodam_stub']['jetpack_submissions'][] = $this->attributes['id'];
				return true;
			}
		}

		/**
		 * A field that always validates.
		 */
		class Contact_Form_Field {

			/**
			 * @var string
			 */
			public $value = '';

			/**
			 * @return void
			 */
			public function validate() {}

			/**
			 * @return bool
			 */
			public function is_error() {
				return false;
			}

			/**
			 * @param string $name Attribute name.
			 * @return string
			 */
			public function get_attribute( $name ) {
				return '';
			}
		}
	}
}
