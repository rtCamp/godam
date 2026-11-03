<?php
/**
 * Unit tests for how the "Get your first video live" steps are marked done.
 *
 * @since n.e.x.t
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\REST_API\Setup_Checklist;

/**
 * @covers \RTGODAM\Inc\REST_API\Setup_Checklist::build_checklist
 */
class SetupChecklistTest extends TestCase {

	/**
	 * Map step ids to their done state.
	 *
	 * @param array $checklist From build_checklist().
	 * @return array
	 */
	private function done_by_id( array $checklist ) {
		return array_column( $checklist['steps'], 'done', 'id' );
	}

	/**
	 * A freshly connected site with videos to move: only "Connect this site" is done.
	 */
	public function test_new_site_with_videos_to_move() {
		$checklist = Setup_Checklist::build_checklist(
			array(
				'connected'      => true,
				'videos_to_move' => 37,
				'vimeo_migrated' => false,
				'video_on_godam' => false,
				'block_used'     => false,
			)
		);

		$this->assertSame(
			array(
				'connect_site' => true,
				'move_videos'  => false,
				'vimeo'        => false,
				'upload_video' => false,
				'add_block'    => false,
			),
			$this->done_by_id( $checklist )
		);
		$this->assertSame( 37, $checklist['steps'][1]['count'] );
		$this->assertSame( 1, $checklist['done'] );
		$this->assertSame( 5, $checklist['total'] );
	}

	/**
	 * Every fact true and nothing left to move: all five steps are done.
	 */
	public function test_all_done() {
		$checklist = Setup_Checklist::build_checklist(
			array(
				'connected'      => true,
				'videos_to_move' => 0,
				'vimeo_migrated' => true,
				'video_on_godam' => true,
				'block_used'     => true,
			)
		);

		$this->assertSame( 5, $checklist['done'] );
		$this->assertSame( 0, $checklist['steps'][1]['count'] );
	}

	/**
	 * A site that never had videos has nothing to move, so that step counts as done.
	 */
	public function test_no_videos_to_move_counts_as_done() {
		$checklist = Setup_Checklist::build_checklist( array( 'connected' => true ) );

		$this->assertTrue( $this->done_by_id( $checklist )['move_videos'] );
		$this->assertSame( 2, $checklist['done'] );
	}

	/**
	 * Missing or bad facts never mark a step done, and a negative count is read as zero.
	 */
	public function test_missing_facts_are_not_done() {
		$checklist = Setup_Checklist::build_checklist( array( 'videos_to_move' => -4 ) );
		$done      = $this->done_by_id( $checklist );

		$this->assertFalse( $done['connect_site'] );
		$this->assertFalse( $done['vimeo'] );
		$this->assertFalse( $done['upload_video'] );
		$this->assertFalse( $done['add_block'] );
		$this->assertSame( 0, $checklist['steps'][1]['count'] );
	}

	/**
	 * Steps come in the order the checklist shows them.
	 */
	public function test_step_order() {
		$checklist = Setup_Checklist::build_checklist( array() );

		$this->assertSame(
			array( 'connect_site', 'move_videos', 'vimeo', 'upload_video', 'add_block' ),
			array_column( $checklist['steps'], 'id' )
		);
	}
}
