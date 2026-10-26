<?php
/**
 * Unit tests for the fields the form listing routes return.
 *
 * The Media Editor's form pickers show each form's title (Forminator: name)
 * and send back its id, so the listings return those and nothing else: not a
 * form's description, its stored content, or its internal client id and status.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Everest_Forms\Everest_Forms_Rest_Api;
use RTGODAM\Inc\REST_API\Forminator_Forms;
use RTGODAM\Inc\REST_API\SureForms;
use RTGODAM\Inc\REST_API\WPForms;

/**
 * @covers \RTGODAM\Inc\REST_API\WPForms::get_gforms
 * @covers \RTGODAM\Inc\REST_API\SureForms::get_sureforms
 * @covers \RTGODAM\Inc\REST_API\Forminator_Forms::get_forminator_forms
 * @covers \RTGODAM\Inc\Everest_Forms\Everest_Forms_Rest_Api::get_forms
 */
class FormListingFieldsTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();

		require_once dirname( __DIR__ ) . '/stubs/form-routes.php';
		require_once dirname( __DIR__ ) . '/stubs/class-wp-rest-request.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/rest-api/class-forminator-forms.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/rest-api/class-sureforms.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/rest-api/class-wpforms.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/everest-forms/class-everest-forms-rest-api.php';

		$GLOBALS['rtgodam_stub'] = array(
			'active_plugins' => array(
				'wpforms-lite/wpforms.php',
				'sureforms/sureforms.php',
				'everest-forms/everest-forms.php',
			),
		);
	}

	protected function tearDown(): void {
		unset( $GLOBALS['rtgodam_stub'] );
		parent::tearDown();
	}

	/**
	 * A form post with everything a form plugin keeps on it.
	 *
	 * @param int $id Post ID.
	 * @return \stdClass
	 */
	private function form_post( $id ) {
		return (object) array(
			'ID'           => $id,
			'post_title'   => 'Form ' . $id,
			'post_excerpt' => 'Description ' . $id,
			'post_content' => '{"settings":{"notification_email":"staff@example.test"}}',
		);
	}

	/**
	 * Data out of a listing handler's response.
	 *
	 * @param mixed $response Response from the handler.
	 * @return array
	 */
	private function data( $response ) {
		$this->assertInstanceOf( \WP_REST_Response::class, $response );
		return $response->get_data();
	}

	/** WPForms: the title and id the picker needs, not the form's description. */
	public function test_wpforms_listing_is_id_and_title() {
		$GLOBALS['rtgodam_stub']['form_posts']['wpforms'] = array( $this->form_post( 7 ), $this->form_post( 8 ) );

		$forms = $this->data( ( new \ReflectionClass( WPForms::class ) )->newInstanceWithoutConstructor()->get_gforms( new \WP_REST_Request() ) );

		$this->assertSame(
			array(
				array(
					'id'    => 7,
					'title' => 'Form 7',
				),
				array(
					'id'    => 8,
					'title' => 'Form 8',
				),
			),
			$forms
		);
	}

	/** SureForms: neither the description nor the block markup is returned. */
	public function test_sureforms_listing_is_id_and_title() {
		$GLOBALS['rtgodam_stub']['form_posts']['sureforms_form'] = array( $this->form_post( 5 ) );

		$routes = ( new \ReflectionClass( SureForms::class ) )->newInstanceWithoutConstructor();
		$routes->get_rest_routes(); // Records that SureForms is active.

		$this->assertSame(
			array(
				array(
					'id'    => 5,
					'title' => 'Form 5',
				),
			),
			$this->data( $routes->get_sureforms( new \WP_REST_Request() ) )
		);
	}

	/** Everest Forms: the description is not returned. */
	public function test_everest_forms_listing_is_id_and_title() {
		$GLOBALS['rtgodam_stub']['form_posts']['everest_form'] = array( $this->form_post( 3 ) );

		$forms = $this->data( ( new \ReflectionClass( Everest_Forms_Rest_Api::class ) )->newInstanceWithoutConstructor()->get_forms( new \WP_REST_Request() ) );

		$this->assertSame(
			array(
				array(
					'id'    => 3,
					'title' => 'Form 3',
				),
			),
			$forms
		);
	}

	/** Forminator: the picker labels a form with its name; the client id and status are not returned. */
	public function test_forminator_listing_is_id_and_name() {
		$GLOBALS['rtgodam_stub']['forminator_forms'] = array(
			(object) array(
				'id'        => 11,
				'name'      => 'Newsletter',
				'client_id' => 'abc123',
				'status'    => 'publish',
			),
		);

		$routes = ( new \ReflectionClass( Forminator_Forms::class ) )->newInstanceWithoutConstructor();
		$routes->get_rest_routes(); // Records that Forminator is active.

		$this->assertSame(
			array(
				array(
					'id'   => 11,
					'name' => 'Newsletter',
				),
			),
			$this->data( $routes->get_forminator_forms( new \WP_REST_Request() ) )
		);
	}
}
