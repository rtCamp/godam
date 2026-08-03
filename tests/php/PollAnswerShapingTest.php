<?php
/**
 * Unit tests for the Poll layer's answer-distribution shaping.
 *
 * The vote tallies rendered on the Poll layer analytics panel come out of the
 * wp-polls plugin's own tables, which GoDAM does not own. These cover the
 * coercion boundary: whatever shape those rows arrive in, the REST response has
 * to be a list of `{ id, answer, votes }` with a matching total, and no markup
 * may reach the React chart.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\REST_API\Polls;

/**
 * @covers \RTGODAM\Inc\REST_API\Polls::shape_poll_answers
 */
class PollAnswerShapingTest extends TestCase {

	/** A normal poll shapes into ordered answers plus their sum. */
	public function test_shapes_answers_and_total() {
		$shaped = Polls::shape_poll_answers(
			array(
				(object) array(
					'polla_aid'     => 1,
					'polla_answers' => 'Yes',
					'polla_votes'   => 20,
				),
				(object) array(
					'polla_aid'     => 2,
					'polla_answers' => 'Maybe',
					'polla_votes'   => 47,
				),
				(object) array(
					'polla_aid'     => 3,
					'polla_answers' => 'No',
					'polla_votes'   => 32,
				),
			)
		);

		$this->assertSame(
			array(
				array(
					'id'     => 1,
					'answer' => 'Yes',
					'votes'  => 20,
				),
				array(
					'id'     => 2,
					'answer' => 'Maybe',
					'votes'  => 47,
				),
				array(
					'id'     => 3,
					'answer' => 'No',
					'votes'  => 32,
				),
			),
			$shaped['answers']
		);
		$this->assertSame( 99, $shaped['total_votes'] );
	}

	/** A poll with no votes yet is a valid, empty-looking distribution. */
	public function test_zero_votes_are_kept() {
		$shaped = Polls::shape_poll_answers(
			array(
				(object) array(
					'polla_aid'     => 1,
					'polla_answers' => 'Yes',
					'polla_votes'   => 0,
				),
			)
		);

		$this->assertCount( 1, $shaped['answers'] );
		$this->assertSame( 0, $shaped['answers'][0]['votes'] );
		$this->assertSame( 0, $shaped['total_votes'] );
	}

	/** Markup in a poll answer must never reach the chart. */
	public function test_markup_is_stripped_from_answers() {
		$shaped = Polls::shape_poll_answers(
			array(
				(object) array(
					'polla_aid'     => 4,
					'polla_answers' => '<script>alert(1)</script>Yes please',
					'polla_votes'   => 3,
				),
			)
		);

		$this->assertSame( 'alert(1)Yes please', $shaped['answers'][0]['answer'] );
	}

	/** A nameless answer is not renderable, but its votes still count. */
	public function test_blank_answer_is_dropped_but_its_votes_still_total() {
		$shaped = Polls::shape_poll_answers(
			array(
				(object) array(
					'polla_aid'     => 1,
					'polla_answers' => 'Yes',
					'polla_votes'   => 10,
				),
				(object) array(
					'polla_aid'     => 2,
					'polla_answers' => '   ',
					'polla_votes'   => 5,
				),
			)
		);

		$this->assertCount( 1, $shaped['answers'] );
		$this->assertSame( 'Yes', $shaped['answers'][0]['answer'] );
		$this->assertSame( 15, $shaped['total_votes'] );
	}

	/** Negative or non-numeric vote counts coerce to a non-negative integer. */
	public function test_vote_counts_are_coerced() {
		$shaped = Polls::shape_poll_answers(
			array(
				(object) array(
					'polla_aid'     => 1,
					'polla_answers' => 'A',
					'polla_votes'   => -4,
				),
				(object) array(
					'polla_aid'     => 2,
					'polla_answers' => 'B',
					'polla_votes'   => '12',
				),
				(object) array(
					'polla_aid'     => 3,
					'polla_answers' => 'C',
					'polla_votes'   => 'not a number',
				),
			)
		);

		$this->assertSame( 4, $shaped['answers'][0]['votes'] );
		$this->assertSame( 12, $shaped['answers'][1]['votes'] );
		$this->assertSame( 0, $shaped['answers'][2]['votes'] );
		$this->assertSame( 16, $shaped['total_votes'] );
	}

	/** Missing columns must not warn or fatal; they fall back to defaults. */
	public function test_missing_columns_fall_back() {
		$shaped = Polls::shape_poll_answers(
			array(
				(object) array( 'polla_answers' => 'Only an answer' ),
			)
		);

		$this->assertSame( 0, $shaped['answers'][0]['id'] );
		$this->assertSame( 0, $shaped['answers'][0]['votes'] );
		$this->assertSame( 'Only an answer', $shaped['answers'][0]['answer'] );
	}

	/** `$wpdb` can be asked for arrays; both row shapes are accepted. */
	public function test_array_rows_are_accepted() {
		$shaped = Polls::shape_poll_answers(
			array(
				array(
					'polla_aid'     => 7,
					'polla_answers' => 'Yes',
					'polla_votes'   => 2,
				),
			)
		);

		$this->assertSame( 7, $shaped['answers'][0]['id'] );
		$this->assertSame( 2, $shaped['total_votes'] );
	}

	/** No rows at all is an empty distribution, not an error. */
	public function test_empty_input() {
		$shaped = Polls::shape_poll_answers( array() );

		$this->assertSame( array(), $shaped['answers'] );
		$this->assertSame( 0, $shaped['total_votes'] );
	}

	/** A null result set (failed query) degrades the same way. */
	public function test_null_input() {
		$shaped = Polls::shape_poll_answers( null );

		$this->assertSame( array(), $shaped['answers'] );
		$this->assertSame( 0, $shaped['total_votes'] );
	}

	/** Scalars inside the result set are skipped rather than fataling. */
	public function test_scalar_rows_are_skipped() {
		$shaped = Polls::shape_poll_answers( array( 'nonsense', 42, null ) );

		$this->assertSame( array(), $shaped['answers'] );
		$this->assertSame( 0, $shaped['total_votes'] );
	}
}
