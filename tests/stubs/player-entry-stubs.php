<?php
/**
 * Narrow WordPress and form-plugin stubs for the tests that render the GoDAM player from
 * an attributes array (the embed page, the video-shortcode route and each form plugin's entry
 * view).
 *
 * Load this file from a test's setUp(), in a separate process (see ViewerEmailNotInPageTest):
 * it declares the base classes of Fluent Forms, Everest Forms and SureForms, and
 * EarlyTranslationHooksTest relies on those being absent in the shared process.
 *
 * Per-case data comes from `$GLOBALS['rtgodam_stub']`:
 *  - `fluent_meta`: the object wpFluent()->...->first() returns, or null.
 *  - `evf_entry`: the object evf_get_entry() returns.
 *  - `srfm_entry`: the array SRFM\Inc\Database\Tables\Entries::get() returns.
 *  - `gform_meta`: Gravity Forms entry meta, by key.
 *  - `wpforms_meta`: WPForms entry meta values, by meta type.
 *  - `elementor_settings`: what the Elementor widget's get_settings_for_display() returns, by control.
 *
 * @package GoDAM
 */

// phpcs:disable Universal.Namespaces.DisallowCurlyBraceSyntax.Forbidden, Universal.Namespaces.DisallowDeclarationWithoutName.Forbidden, Universal.Files.SeparateFunctionsFromOO.Mixed, Universal.Namespaces.OneDeclarationPerFile.MultipleFound, Generic.Files.OneObjectStructurePerFile.MultipleFound, WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound, WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedClassFound, WordPress.NamingConventions.ValidFunctionName.FunctionNameInvalid, Generic.CodeAnalysis.UnusedFunctionParameter.Found, Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed -- test stubs mirroring WP / third-party APIs.

namespace FluentForm\App\Services\FormBuilder {

	if ( ! class_exists( __NAMESPACE__ . '\BaseFieldManager' ) ) {
		/**
		 * Fluent Forms' base field manager; the recorder field only needs it to exist.
		 */
		class BaseFieldManager {}
	}
}

namespace Elementor {

	if ( ! class_exists( __NAMESPACE__ . '\Widget_Base' ) ) {
		/**
		 * Elementor's widget base; a widget only reads its settings through it.
		 */
		class Widget_Base {

			/**
			 * @param string $setting Control name.
			 * @return mixed The value the test set for the control, or ''.
			 */
			public function get_settings_for_display( $setting = '' ) {
				return $GLOBALS['rtgodam_stub']['elementor_settings'][ $setting ] ?? '';
			}
		}
	}
}

namespace SRFM\Inc\Database\Tables {

	if ( ! class_exists( __NAMESPACE__ . '\Entries' ) ) {
		/**
		 * SureForms' entries table.
		 */
		class Entries {

			/**
			 * @param int $entry_id Entry ID.
			 * @return array|null The entry the test set up.
			 */
			public static function get( $entry_id ) {
				return $GLOBALS['rtgodam_stub']['srfm_entry'] ?? null;
			}
		}
	}
}

namespace {

	if ( ! class_exists( 'EVF_Form_Fields_Upload' ) ) {
		/**
		 * Everest Forms' upload field; the GoDAM field only needs it to exist.
		 */
		class EVF_Form_Fields_Upload {}
	}

	if ( ! class_exists( 'GFCommon' ) ) {
		/**
		 * Gravity Forms' common helpers.
		 */
		class GFCommon {

			/**
			 * @return bool
			 */
			public static function is_ssl() {
				return false;
			}
		}
	}

	/*
	 * Gravity Forms' field classes come from gravity-forms-fields.php, which the test requires
	 * itself; the helpers below are the ones the entry view reads.
	 */

	if ( ! function_exists( 'rgar' ) ) {

		/**
		 * @param array  $source Array to read.
		 * @param string $name   Key.
		 * @return mixed
		 */
		function rgar( $source, $name ) {
			return isset( $source[ $name ] ) ? $source[ $name ] : '';
		}
	}

	if ( ! function_exists( 'rgget' ) ) {

		/**
		 * @param string $name Query-string key.
		 * @return mixed
		 */
		function rgget( $name ) {
			return $_GET[ $name ] ?? ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- stub.
		}
	}

	if ( ! function_exists( 'gform_get_meta' ) ) {

		/**
		 * @param int    $entry_id Entry ID.
		 * @param string $meta_key Meta key.
		 * @return mixed False when the test set nothing up for the key.
		 */
		function gform_get_meta( $entry_id, $meta_key ) {
			return $GLOBALS['rtgodam_stub']['gform_meta'][ $meta_key ] ?? false;
		}
	}

	if ( ! function_exists( 'evf_get_entry' ) ) {

		/**
		 * @param int  $entry_id Entry ID.
		 * @param bool $meta     Whether to load meta.
		 * @return object|false
		 */
		function evf_get_entry( $entry_id, $meta = true ) {
			return $GLOBALS['rtgodam_stub']['evf_entry'] ?? false;
		}
	}

	if ( ! function_exists( 'wpFluent' ) ) {

		/**
		 * A query builder that answers every chain with the `fluent_meta` object.
		 *
		 * @return object
		 */
		function wpFluent() {
			return new class() {

				/**
				 * @param string $table Table name.
				 * @return $this
				 */
				public function table( $table ) {
					return $this;
				}

				/**
				 * @param string $column Column.
				 * @param mixed  $value  Value.
				 * @return $this
				 */
				public function where( $column, $value ) {
					return $this;
				}

				/**
				 * @return object|null
				 */
				public function first() {
					return $GLOBALS['rtgodam_stub']['fluent_meta'] ?? null;
				}
			};
		}
	}

	if ( ! function_exists( 'wpforms' ) ) {

		/**
		 * A WPForms instance whose entry meta answers from the `wpforms_meta` values.
		 *
		 * @return object
		 */
		function wpforms() {
			return (object) array(
				'entry_meta' => new class() {

					/**
					 * @param array $args Query; only `type` is read.
					 * @return array|false One row per meta type the test set up.
					 */
					public function get_meta( $args ) {
						$value = $GLOBALS['rtgodam_stub']['wpforms_meta'][ $args['type'] ] ?? null;

						return null === $value ? false : array( (object) array( 'data' => $value ) );
					}
				},
			);
		}
	}

	if ( ! function_exists( 'wpforms_html_attributes' ) ) {

		/**
		 * @return string
		 */
		function wpforms_html_attributes() {
			return '';
		}
	}

	if ( ! function_exists( 'wp_unslash' ) ) {

		/**
		 * @param string|array $value Value to unslash.
		 * @return string|array
		 */
		function wp_unslash( $value ) {
			return is_array( $value ) ? array_map( 'wp_unslash', $value ) : stripslashes( (string) $value );
		}
	}

	if ( ! function_exists( 'esc_html_e' ) ) {

		/**
		 * @param string $text   Text to translate.
		 * @param string $domain Text domain.
		 * @return void
		 */
		function esc_html_e( $text, $domain = 'default' ) {
			echo esc_html__( $text, $domain ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- esc_html__() escapes.
		}
	}

	if ( ! function_exists( 'force_balance_tags' ) ) {

		/**
		 * @param string $text Markup.
		 * @return string
		 */
		function force_balance_tags( $text ) {
			return $text;
		}
	}

	if ( ! function_exists( 'wp_basename' ) ) {

		/**
		 * @param string $path Path.
		 * @return string
		 */
		function wp_basename( $path ) {
			return basename( $path );
		}
	}

	if ( ! function_exists( 'wp_check_filetype' ) ) {

		/**
		 * Like core, takes the extension from the end of the whole name.
		 *
		 * @param string $filename File name or URL.
		 * @return array{ext: string|false, type: string|false}
		 */
		function wp_check_filetype( $filename ) {
			$types = array(
				'webm' => 'video/webm',
				'mp4'  => 'video/mp4',
				'mp3'  => 'audio/mpeg',
				'ogg'  => 'audio/ogg',
			);

			if ( preg_match( '!\.(' . implode( '|', array_keys( $types ) ) . ')$!i', (string) $filename, $matches ) ) {
				$ext = strtolower( $matches[1] );

				return array(
					'ext'  => $ext,
					'type' => $types[ $ext ],
				);
			}

			return array(
				'ext'  => false,
				'type' => false,
			);
		}
	}

	if ( ! function_exists( 'get_the_date' ) ) {

		/**
		 * @param string $format Date format.
		 * @param mixed  $post   Post.
		 * @return string
		 */
		function get_the_date( $format = '', $post = null ) {
			return 'January 1, 2026';
		}
	}

	if ( ! function_exists( 'sanitize_key' ) ) {

		/**
		 * @param string $key Input.
		 * @return string
		 */
		function sanitize_key( $key ) {
			return preg_replace( '/[^a-z0-9_\-]/', '', strtolower( (string) $key ) );
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
}
