<?php
/**
 * The one-time upgrade step that moves transcoded MP3 audio from `audio/mp3` to `audio/mpeg`.
 *
 * WordPress registers MP3 as `audio/mpeg`, so attachments stored as `audio/mp3` were left out
 * of the REST API's `media_type=audio` and ignored by its `mime_type` filter.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Migrations\Transcoded_Mp3_Mime_Type;

/**
 * Runs in separate processes, like the other tests that stub WordPress functions.
 *
 * @covers \RTGODAM\Inc\Migrations\Transcoded_Mp3_Mime_Type::maybe_run
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class TranscodedMp3MimeTypeTest extends TestCase {

	/**
	 * Load the class under test and stub the slice of WordPress it touches.
	 */
	protected function setUp(): void {
		parent::setUp();

		$GLOBALS['rtgodam_stub'] = array( 'cleaned' => array() );

		require_once dirname( __DIR__, 2 ) . '/inc/classes/migrations/class-transcoded-mp3-mime-type.php';

		// phpcs:ignore Squiz.PHP.Eval.Discouraged -- test-only stub, isolated process.
		eval( 'function update_option( $key, $value ) { $GLOBALS["rtgodam_stub"]["options"][ $key ] = $value; return true; }' );
		// phpcs:ignore Squiz.PHP.Eval.Discouraged -- test-only stub, isolated process.
		eval( 'function clean_post_cache( $id ) { $GLOBALS["rtgodam_stub"]["cleaned"][] = $id; }' );

		$GLOBALS['wpdb'] = new class() {

			/**
			 * Table prefix-qualified posts table name.
			 *
			 * @var string
			 */
			public $posts = 'wp_posts';

			/**
			 * Rows of the posts table: ID => [ post_type, post_mime_type ].
			 *
			 * @var array
			 */
			public $rows = array();

			/**
			 * When true, the UPDATE fails the way $wpdb->query() does.
			 *
			 * @var bool
			 */
			public $fail_update = false;

			/**
			 * When true, the SELECT fails the way $wpdb->get_col() does: an empty list and an error.
			 *
			 * @var bool
			 */
			public $fail_select = false;

			/**
			 * The last database error, as $wpdb keeps it.
			 *
			 * @var string
			 */
			public $last_error = '';

			/**
			 * Number of UPDATE queries run.
			 *
			 * @var int
			 */
			public $updates = 0;

			/**
			 * Keep the query and its values together; the fake reads the values, not the SQL.
			 *
			 * @param string $query SQL with placeholders.
			 * @param mixed  ...$args Values.
			 * @return array
			 */
			public function prepare( $query, ...$args ) {
				return array(
					'sql'  => $query,
					'args' => $args,
				);
			}

			/**
			 * IDs of attachments with the given type.
			 *
			 * @param array $prepared Output of prepare().
			 * @return string[]
			 */
			public function get_col( $prepared ) {
				if ( $this->fail_select ) {
					$this->last_error = 'Lost connection to MySQL server during query';
					return array();
				}
				$ids = array();
				foreach ( $this->rows as $id => $row ) {
					if ( 'attachment' === $row[0] && $prepared['args'][0] === $row[1] ) {
						$ids[] = (string) $id;
					}
				}
				return $ids;
			}

			/**
			 * Change the type of matching attachments.
			 *
			 * @param array $prepared Output of prepare().
			 * @return int|false Rows changed, or false on a database error.
			 */
			public function query( $prepared ) {
				++$this->updates;
				if ( $this->fail_update ) {
					return false;
				}
				list( $new_type, $old_type ) = $prepared['args'];
				$changed                     = 0;
				foreach ( $this->rows as $id => $row ) {
					if ( 'attachment' === $row[0] && $old_type === $row[1] ) {
						$this->rows[ $id ][1] = $new_type;
						++$changed;
					}
				}
				return $changed;
			}
		};
	}

	/**
	 * Transcoded MP3 attachments move to audio/mpeg; nothing else changes.
	 */
	public function test_audio_mp3_attachments_become_audio_mpeg() {
		$GLOBALS['wpdb']->rows = array(
			10 => array( 'attachment', 'audio/mp3' ),
			11 => array( 'attachment', 'audio/mp3' ),
			12 => array( 'attachment', 'audio/mpeg' ),
			13 => array( 'attachment', 'audio/wav' ),
			14 => array( 'attachment', 'video/mp4' ),
			15 => array( 'post', 'audio/mp3' ),
		);

		$this->assertTrue( Transcoded_Mp3_Mime_Type::maybe_run() );

		$this->assertSame(
			array(
				10 => array( 'attachment', 'audio/mpeg' ),
				11 => array( 'attachment', 'audio/mpeg' ),
				12 => array( 'attachment', 'audio/mpeg' ),
				13 => array( 'attachment', 'audio/wav' ),
				14 => array( 'attachment', 'video/mp4' ),
				15 => array( 'post', 'audio/mp3' ),
			),
			$GLOBALS['wpdb']->rows
		);
		$this->assertSame( array( 10, 11 ), $GLOBALS['rtgodam_stub']['cleaned'], 'A changed attachment kept its cached type.' );
		$this->assertSame( 'done', get_option( Transcoded_Mp3_Mime_Type::OPTION_KEY ) );
	}

	/**
	 * A site with no MP3 attachments runs no UPDATE and is marked done.
	 */
	public function test_a_site_without_mp3_attachments_is_marked_done() {
		$GLOBALS['wpdb']->rows = array( 12 => array( 'attachment', 'audio/mpeg' ) );

		$this->assertTrue( Transcoded_Mp3_Mime_Type::maybe_run() );

		$this->assertSame( 0, $GLOBALS['wpdb']->updates );
		$this->assertSame( 'done', get_option( Transcoded_Mp3_Mime_Type::OPTION_KEY ) );
	}

	/**
	 * A failed UPDATE is not marked done, so the runner tries again on a later request.
	 */
	public function test_a_failed_update_is_retried() {
		$GLOBALS['wpdb']->rows        = array( 10 => array( 'attachment', 'audio/mp3' ) );
		$GLOBALS['wpdb']->fail_update = true;

		$this->assertFalse( Transcoded_Mp3_Mime_Type::maybe_run() );

		$this->assertFalse( get_option( Transcoded_Mp3_Mime_Type::OPTION_KEY ) );
		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['cleaned'] );
	}

	/**
	 * A failed SELECT looks like "no MP3 attachments"; it must not mark the site done.
	 */
	public function test_a_failed_select_is_retried() {
		$GLOBALS['wpdb']->rows        = array( 10 => array( 'attachment', 'audio/mp3' ) );
		$GLOBALS['wpdb']->fail_select = true;

		$this->assertFalse( Transcoded_Mp3_Mime_Type::maybe_run() );

		$this->assertFalse( get_option( Transcoded_Mp3_Mime_Type::OPTION_KEY ) );
		$this->assertSame( 0, $GLOBALS['wpdb']->updates );
	}

	/**
	 * Once done, it never queries again.
	 */
	public function test_it_runs_only_once() {
		$GLOBALS['rtgodam_stub']['options'][ Transcoded_Mp3_Mime_Type::OPTION_KEY ] = 'done';
		$GLOBALS['wpdb']->rows = array( 10 => array( 'attachment', 'audio/mp3' ) );

		$this->assertTrue( Transcoded_Mp3_Mime_Type::maybe_run() );

		$this->assertSame( 0, $GLOBALS['wpdb']->updates );
		$this->assertSame( 'audio/mp3', $GLOBALS['wpdb']->rows[10][1] );
	}

	/**
	 * The migration runner has it in a batch, so updating the plugin runs it.
	 *
	 * Every other test here calls maybe_run() directly, so without this a wrong map entry would leave them all green
	 * while the fix never ran.
	 */
	public function test_the_migration_runner_runs_it() {
		require_once dirname( __DIR__, 2 ) . '/inc/classes/migrations/class-runner.php';

		$map = ( new \ReflectionClass( \RTGODAM\Inc\Migrations\Runner::class ) )->getProperty( 'migrations' );
		$map->setAccessible( true );
		$migrations = $map->getValue();

		// 2.4.1 shipped without this fix but still stores 2.4.1 as the site's version, and the runner skips
		// batches at or below the stored version, so a batch keyed 2.4.1 or lower would never run on those sites.
		$this->assertArrayHasKey( '2.5.0', $migrations, 'No migration batch for the release this ships in.' );
		$this->assertContains( Transcoded_Mp3_Mime_Type::class, $migrations['2.5.0'] );
		$versions = array_keys( $migrations );
		$ordered  = $versions;
		usort( $ordered, 'version_compare' );
		$this->assertSame( $ordered, $versions, 'Batches must stay ordered oldest to newest.' );
	}
}
