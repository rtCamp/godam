<?php
/**
 * Narrow form-plugin class stubs, so the Ninja Forms and Fluent Forms recorder fields can load outside WordPress.
 *
 * The parents are empty, and the Fluent Forms helpers return what the test sets in
 * `$GLOBALS['rtgodam_stub']`:
 *  - `fluent_fields`  what FormFieldsParser::getElement() returns for the form.
 *
 * @package GoDAM
 */

// phpcs:disable Generic.Files.OneObjectStructurePerFile.MultipleFound, Universal.Namespaces.DisallowCurlyBraceSyntax, Universal.Namespaces.DisallowDeclarationWithoutName, Universal.Namespaces.OneDeclarationPerFile, Generic.CodeAnalysis.UnusedFunctionParameter -- each stub has to sit in the namespace of the class it stands in for.

namespace {
	if ( ! class_exists( 'NF_Abstracts_Field' ) ) {
		/**
		 * Stub of Ninja Forms' base field.
		 */
		abstract class NF_Abstracts_Field {} // phpcs:ignore Squiz.Classes.ValidClassName.NotCamelCaps -- Ninja Forms' class name.
	}
}

namespace FluentForm\App\Services\FormBuilder {
	if ( ! class_exists( BaseFieldManager::class ) ) {
		/**
		 * Stub of Fluent Forms' base field manager.
		 */
		abstract class BaseFieldManager {}
	}
}

namespace FluentForm\App\Modules\Form {
	if ( ! class_exists( FormFieldsParser::class ) ) {
		/**
		 * Stub of Fluent Forms' form parser.
		 */
		class FormFieldsParser {

			/**
			 * @param object $form    Form.
			 * @param array  $element Elements to find.
			 * @param array  $with    What to extract.
			 * @return array The fields the test set.
			 */
			public static function getElement( $form, $element, $with = array() ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found, WordPress.NamingConventions.ValidFunctionName.MethodNameInvalid -- mirrors Fluent Forms' signature.
				return $GLOBALS['rtgodam_stub']['fluent_fields'] ?? array();
			}
		}
	}
}

namespace FluentForm\App\Helpers {
	if ( ! class_exists( Protector::class ) ) {
		/**
		 * Stub of Fluent Forms' file name protector.
		 */
		class Protector {

			/**
			 * @param string $text Text.
			 * @return string A recognisable stand-in for the encrypted text.
			 */
			public static function encrypt( $text ) {
				return 'enc-' . $text;
			}
		}
	}
}

namespace FluentForm\Framework\Helpers {
	if ( ! class_exists( ArrayHelper::class ) ) {
		/**
		 * Stub of Fluent Forms' array helper.
		 */
		class ArrayHelper {

			/**
			 * @param array  $array_value Array.
			 * @param string $key         Key.
			 * @return mixed
			 */
			public static function get( $array_value, $key ) {
				return $array_value[ $key ] ?? null;
			}
		}
	}
}
