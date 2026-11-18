<?php
/**
 * Tests how godam/add-central-media finds an item on GoDAM Central.
 *
 * @package GoDAM
 */

declare( strict_types = 1 );

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Abilities\Library_Abilities;

require_once dirname( __DIR__, 2 ) . '/inc/classes/abilities/class-ability-group.php';
require_once dirname( __DIR__, 2 ) . '/inc/classes/abilities/class-library-abilities.php';

/**
 * GoDAM Central has no lookup by ID for a site key. An account with hundreds of
 * items took 10 to 36 seconds per add when every add read the whole list, and
 * one failed list request failed the add.
 *
 * @covers \RTGODAM\Inc\Abilities\Library_Abilities
 */
class CentralMediaLookupTest extends TestCase {

	/**
	 * Library abilities with GoDAM Central's list replaced by a script.
	 *
	 * @param array<string,array> $answers Answers by "type|page|search", each a list used one per call (the last one repeats).
	 *
	 * @return Library_Abilities
	 */
	private function library( array $answers = array() ) {
		$library = new class() extends Library_Abilities {
			/**
			 * Requests made, as "type|page|search".
			 *
			 * @var string[]
			 */
			public $calls = array();

			/**
			 * Answers by request, each a list used one per call (the last one repeats).
			 *
			 * @var array<string,array>
			 */
			public $answers = array();

			/**
			 * Skips the real constructor, which registers hooks.
			 */
			public function __construct() {}

			/**
			 * Answers a request from the script.
			 *
			 * @param string $method HTTP method.
			 * @param string $route  REST route.
			 * @param array  $params Request parameters.
			 *
			 * @return array|\WP_Error
			 */
			protected function rest( $method, $route, array $params = array() ) {
				$key           = $params['type'] . '|' . $params['page'] . '|' . ( $params['search'] ?? '' );
				$this->calls[] = $key;

				if ( empty( $this->answers[ $key ] ) ) {
					return array(
						'success'  => true,
						'data'     => array(),
						'has_more' => false,
					);
				}

				return count( $this->answers[ $key ] ) > 1 ? array_shift( $this->answers[ $key ] ) : $this->answers[ $key ][0];
			}
		};

		$library->answers = $answers;

		return $library;
	}

	/**
	 * One page of a GoDAM Central list.
	 *
	 * @param string[] $ids      Item IDs on the page.
	 * @param bool     $has_more Whether another page follows.
	 *
	 * @return array
	 */
	private function page( array $ids, $has_more = false ) {
		return array(
			'success'  => true,
			'data'     => array_map(
				static function ( $id ) {
					return array(
						'id'  => $id,
						'url' => 'https://cdn.example/' . $id,
					);
				},
				$ids
			),
			'has_more' => $has_more,
		);
	}

	/**
	 * Runs the lookup.
	 *
	 * @param Library_Abilities $library    The scripted library.
	 * @param string                   $central_id The item to find.
	 * @param string                   $type       Type hint.
	 * @param string                   $title      Title hint.
	 *
	 * @return array|null|\WP_Error
	 */
	private function find( Library_Abilities $library, $central_id, $type = '', $title = '' ) {
		$method = ( new \ReflectionClass( Library_Abilities::class ) )->getMethod( 'find_central_item' );

		if ( PHP_VERSION_ID < 80100 ) {
			$method->setAccessible( true );
		}

		return $method->invoke( $library, $central_id, $type, $title );
	}

	/**
	 * With the type and title, the item is found in one request.
	 *
	 * @return void
	 */
	public function test_type_and_title_find_the_item_in_one_request() {
		$library = $this->library( array( 'image|1|coast at sunset' => array( $this->page( array( 'abc' ) ) ) ) );

		$found = $this->find( $library, 'abc', 'image', 'coast at sunset' );

		$this->assertSame( 'abc', $found['id'] );
		$this->assertSame( array( 'image|1|coast at sunset' ), $library->calls );
	}

	/**
	 * A search that misses falls back to the full read, the given type first.
	 *
	 * @return void
	 */
	public function test_a_missed_search_falls_back_to_the_full_list() {
		$library = $this->library(
			array(
				'image|1|' => array( $this->page( array( 'x' ), true ) ),
				'image|2|' => array( $this->page( array( 'abc' ) ) ),
			) 
		);

		$found = $this->find( $library, 'abc', 'image', 'renamed since' );

		$this->assertSame( 'abc', $found['id'] );
		$this->assertSame( array( 'image|1|renamed since', 'image|1|', 'image|2|' ), $library->calls );
	}

	/**
	 * One failed list request is tried again before the add fails.
	 *
	 * @return void
	 */
	public function test_a_failed_request_is_tried_once_more() {
		$library = $this->library(
			array(
				'video|1|' => array(
					array( 'success' => false ),
					$this->page( array( 'abc' ) ),
				),
			) 
		);

		$found = $this->find( $library, 'abc' );

		$this->assertSame( 'abc', $found['id'] );
		$this->assertSame( array( 'video|1|', 'video|1|' ), $library->calls );
	}

	/**
	 * Two failures in a row are reported, with the next step in the message.
	 *
	 * @return void
	 */
	public function test_two_failures_return_the_error() {
		$library = $this->library( array( 'video|1|' => array( array( 'success' => false ) ) ) );

		$found = $this->find( $library, 'abc' );

		$this->assertInstanceOf( \WP_Error::class, $found );
		$this->assertSame( 'rtgodam_central_unavailable', $found->get_error_code() );
		$this->assertStringContainsString( 'app.godam.io/helpdesk', $found->get_error_message() );
	}

	/**
	 * An item that is in no list is reported as not found, not as an error.
	 *
	 * @return void
	 */
	public function test_an_unknown_item_is_null() {
		$library = $this->library();

		$this->assertNull( $this->find( $library, 'nope', 'video', 'nothing' ) );
	}

	/**
	 * A type that is not one of ours is ignored, so it cannot reach GoDAM Central.
	 *
	 * @return void
	 */
	public function test_an_unknown_type_is_ignored() {
		$library = $this->library( array( 'video|1|' => array( $this->page( array( 'abc' ) ) ) ) );

		$found = $this->find( $library, 'abc', 'text/html' );

		$this->assertSame( 'abc', $found['id'] );
		$this->assertSame( array( 'video|1|' ), $library->calls );
	}
}
