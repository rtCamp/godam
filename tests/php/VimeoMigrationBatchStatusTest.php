<?php
/**
 * Unit tests for adding a finished migration batch to the stored status.
 *
 * Both the locked update and the best-effort one (when the lock can't be
 * taken) go through Video_Migration::add_batch_to_status(), so either one
 * adds the batch's Vimeo counts and can complete the run.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\REST_API\Video_Migration;

require_once dirname( __DIR__ ) . '/stubs/i18n.php';
require_once dirname( __DIR__ ) . '/stubs/vimeo-migration-functions.php';

/**
 * @covers \RTGODAM\Inc\REST_API\Video_Migration::add_batch_to_status
 */
class VimeoMigrationBatchStatusTest extends TestCase {

	/**
	 * Call the private add_batch_to_status().
	 *
	 * @param array  $status Stored status.
	 * @param string $type   Migration type.
	 * @param int    $size   Batch size.
	 * @param array  $counts Batch Vimeo counts by source.
	 *
	 * @return array
	 */
	private function add_batch( array $status, string $type, int $size, array $counts = array() ): array {
		$class     = new \ReflectionClass( Video_Migration::class );
		$migration = $class->newInstanceWithoutConstructor();
		$method    = $class->getMethod( 'add_batch_to_status' );
		$method->setAccessible( true );

		return $method->invoke( $migration, $status, $type, $size, $counts );
	}

	public function test_a_middle_batch_adds_its_posts_and_vimeo_counts() {
		$status = $this->add_batch(
			array(
				'status'        => 'processing',
				'total'         => 30,
				'done'          => 10,
				'vimeo_sources' => array(
					'gutenberg' => array(
						'found'    => 2,
						'migrated' => 1,
					),
				),
			),
			'vimeo',
			10,
			array(
				'gutenberg' => array(
					'found'    => 1,
					'migrated' => 1,
				),
				'elementor' => array(
					'found'    => 3,
					'migrated' => 2,
				),
			)
		);

		$this->assertSame( 20, $status['done'] );
		$this->assertSame( 'processing', $status['status'] );
		$this->assertSame(
			array(
				'found'    => 3,
				'migrated' => 2,
			),
			$status['vimeo_sources']['gutenberg']
		);
		$this->assertSame(
			array(
				'found'    => 3,
				'migrated' => 2,
			),
			$status['vimeo_sources']['elementor']
		);
		$this->assertSame( 3, $status['vimeo_blocks_found'] );
		$this->assertSame( 2, $status['vimeo_blocks_migrated'] );
		$this->assertStringContainsString( '20/30', $status['message'] );
	}

	public function test_the_last_batch_completes_the_run() {
		$status = $this->add_batch(
			array(
				'status' => 'processing',
				'total'  => 20,
				'done'   => 10,
			),
			'vimeo',
			10,
			array(
				'acf' => array(
					'found'    => 4,
					'migrated' => 4,
				),
			)
		);

		$this->assertSame( 'completed', $status['status'] );
		$this->assertSame( '2026-11-25 12:00:00', $status['completed'] );
		$this->assertStringContainsString( 'Replaced 4 of 4', $status['message'] );
	}

	public function test_a_core_migration_completes_without_vimeo_counts() {
		$status = $this->add_batch(
			array(
				'total' => 5,
				'done'  => 0,
			),
			'core',
			5
		);

		$this->assertSame( 'completed', $status['status'] );
		$this->assertArrayNotHasKey( 'vimeo_sources', $status );
	}
}
