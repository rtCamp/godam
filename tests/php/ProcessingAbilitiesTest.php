<?php
/**
 * Tests how godam/retranscode-media reports a retranscode the route skipped.
 *
 * @package GoDAM
 */

declare( strict_types = 1 );

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Abilities\Processing_Abilities;

/**
 * The retranscode route answers 200 with `skipped: true` when it does not send
 * the job (virtual media, storage over the limit, a Central refusal). The
 * ability must report that as an error, not as a job accepted and queued.
 *
 * Runs in its own process because it defines core functions.
 *
 * @covers \RTGODAM\Inc\Abilities\Processing_Abilities::retranscode_media
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class ProcessingAbilitiesTest extends TestCase {

	/**
	 * Returns the ability, fed a canned answer from the route instead of running it.
	 *
	 * @param mixed $payload What the retranscode route answers with.
	 *
	 * @return Processing_Abilities
	 */
	private function ability( $payload ) {
		require_once dirname( __DIR__, 2 ) . '/inc/classes/abilities/class-ability-group.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/abilities/class-processing-abilities.php';

		// phpcs:disable Squiz.PHP.Eval.Discouraged -- test-only stub, isolated process.
		if ( ! function_exists( 'sanitize_key' ) ) {
			eval( 'function sanitize_key( $key ) { return strtolower( preg_replace( "/[^a-zA-Z0-9_\-]/", "", (string) $key ) ); }' );
		}
		// phpcs:enable Squiz.PHP.Eval.Discouraged

		return new class( $payload ) extends Processing_Abilities {

			/**
			 * What the route answers with.
			 *
			 * @var mixed
			 */
			private $payload;

			/**
			 * Sets the canned answer.
			 *
			 * @param mixed $payload What the route answers with.
			 */
			public function __construct( $payload ) {
				$this->payload = $payload;
			}

			/**
			 * Answers with the canned payload instead of running the route.
			 *
			 * @param string $method HTTP method.
			 * @param string $route  Full route.
			 * @param array  $params Request parameters.
			 *
			 * @return mixed
			 */
			protected function rest( $method, $route, array $params = array() ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found -- signature mirrors the parent.
				return $this->payload;
			}

			/**
			 * Any ID is an attachment.
			 *
			 * @param int $attachment_id Attachment ID.
			 *
			 * @return object
			 */
			protected function get_attachment( $attachment_id ) {
				return (object) array(
					'ID'        => (int) $attachment_id,
					'post_type' => 'attachment',
				);
			}
		};
	}

	/**
	 * A skipped retranscode is an error that carries the route's reason and its own message.
	 *
	 * @dataProvider skipped_routes
	 *
	 * @param string $reason  The route's `reason`.
	 * @param string $message The route's message, as the route builds it.
	 * @param string $plain   The same message as plain text.
	 *
	 * @return void
	 */
	public function test_a_skipped_retranscode_is_an_error( $reason, $message, $plain ) {
		$result = $this->ability(
			array(
				'message' => $message,
				'skipped' => true,
				'reason'  => $reason,
			)
		)->retranscode_media( array( 'id' => 55 ) );

		$this->assertInstanceOf( \WP_Error::class, $result, 'A skipped retranscode is not "accepted".' );
		$this->assertSame( $reason, $result->get_error_code() );
		$this->assertSame( $plain, $result->get_error_message(), 'The route names the next step; the agent gets that text, without HTML.' );
		$this->assertSame( array( 'status' => 409 ), $result->get_error_data() );
	}

	/**
	 * The skipped answers the route gives.
	 *
	 * @return array
	 */
	public function skipped_routes() {
		return array(
			'virtual media'        => array(
				'virtual_media',
				'Clip &amp; trailer (ID 55) is virtual media from GoDAM Central. Please retranscode this media on GoDAM Central.',
				'Clip & trailer (ID 55) is virtual media from GoDAM Central. Please retranscode this media on GoDAM Central.',
			),
			'storage over limit'   => array(
				'storage_exceeded',
				'Intro (ID 55) cannot be retranscoded. Storage limit exceeded (104.2%). Please upgrade your plan to continue transcoding.',
				'Intro (ID 55) cannot be retranscoded. Storage limit exceeded (104.2%). Please upgrade your plan to continue transcoding.',
			),
			'Central refusal code' => array(
				'preflight_failed',
				'It&#039;s here (ID 55) cannot be transcoded. The file is too long for your plan. (Details: duration limit)',
				'It\'s here (ID 55) cannot be transcoded. The file is too long for your plan. (Details: duration limit)',
			),
		);
	}

	/**
	 * A skipped answer with no reason still comes back as an error.
	 *
	 * @return void
	 */
	public function test_a_skipped_answer_without_a_reason_gets_a_fallback_code() {
		$result = $this->ability(
			array(
				'message' => 'Not sent.',
				'skipped' => true,
			)
		)->retranscode_media( array( 'id' => 55 ) );

		$this->assertInstanceOf( \WP_Error::class, $result );
		$this->assertSame( 'rtgodam_retranscode_skipped', $result->get_error_code() );
		$this->assertSame( 'Not sent.', $result->get_error_message() );
	}

	/**
	 * A job the route sent is still reported as accepted.
	 *
	 * @return void
	 */
	public function test_a_sent_retranscode_is_accepted() {
		$payload = array(
			'message' => 'Clip (ID 55) transcoding request was sent successfully',
			'skipped' => false,
			'sent'    => true,
		);
		$result  = $this->ability( $payload )->retranscode_media( array( 'id' => 55 ) );

		$this->assertIsArray( $result );
		$this->assertTrue( $result['accepted'] );
		$this->assertSame( 55, $result['media_id'] );
		$this->assertSame( $payload, $result['response'] );
	}
}
