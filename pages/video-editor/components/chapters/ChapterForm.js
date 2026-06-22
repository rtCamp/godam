/**
 * WordPress dependencies
 */
import { Button } from '@wordpress/components';
import { useState, useEffect } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { plus } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { VeTextInput } from '../controls';
import { parseTimeToSeconds } from './utils';

/**
 * The add / edit chapter form: a title, an editable start time, and an editable
 * end time. The end defaults to the video duration (shown as the placeholder).
 * Chapters may not overlap — when the entered range collides with another
 * chapter the form shows a message and blocks the submit.
 *
 * @param {Object}      props                    Props.
 * @param {Array}       props.rows               Ordered chapter rows (for overlap checks).
 * @param {number}      props.duration           Video duration, in seconds.
 * @param {Function}    props.formatTimeForInput Formats seconds to the display string.
 * @param {Object|null} props.editingRow         The row being edited, or null to add.
 * @param {Function}    props.onSubmit           Called with `{ id, title, startSeconds, endSeconds }`.
 * @param {Function}    props.onCancel           Leaves edit mode.
 * @return {JSX.Element} The form.
 */
const ChapterForm = ( { rows, duration, formatTimeForInput, editingRow, onSubmit, onCancel } ) => {
	const editingId = editingRow?.id ?? null;
	const durationLabel = formatTimeForInput( duration ) || '0:00';
	// New chapters start where the latest existing chapter ends.
	const lastEnd = rows.length ? Math.max( ...rows.map( ( row ) => row.endSeconds ) ) : 0;

	const [ title, setTitle ] = useState( '' );
	const [ startInput, setStartInput ] = useState( '' );
	const [ endInput, setEndInput ] = useState( '' );

	// Load the selected chapter's values, or reset when switching to add mode.
	useEffect( () => {
		if ( editingRow ) {
			setTitle( editingRow.text || '' );
			setStartInput( formatTimeForInput( editingRow.startSeconds ) || '0:00' );
			setEndInput( formatTimeForInput( editingRow.endSeconds ) || '' );
		} else {
			setTitle( '' );
			setStartInput( formatTimeForInput( lastEnd ) || '0:00' );
			setEndInput( '' );
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ editingId ] );

	const trimmedTitle = title.trim();
	const parsedStart = startInput.trim() === '' ? 0 : parseTimeToSeconds( startInput );
	// An empty end means "run to the end of the video" (the placeholder default).
	const parsedEnd = endInput.trim() === '' ? duration : parseTimeToSeconds( endInput );

	let startError = '';
	let endError = '';

	if ( parsedStart < 0 ) {
		startError = __( 'Start time cannot be negative', 'godam' );
	} else if ( duration > 0 && parsedStart > duration ) {
		startError = __( 'Start time exceeds the video duration', 'godam' );
	}

	if ( ! startError ) {
		if ( parsedEnd <= parsedStart ) {
			endError = __( 'End time must be after the start time', 'godam' );
		} else if ( duration > 0 && parsedEnd > duration ) {
			endError = __( 'End time exceeds the video duration', 'godam' );
		} else {
			// Overlap: ranges intersect when start < other end and other start < end.
			const conflict = rows.find(
				( row ) => row.id !== editingId && parsedStart < row.endSeconds && row.startSeconds < parsedEnd,
			);
			if ( conflict ) {
				const name = conflict.text?.trim();
				endError = name
					? sprintf(
						// translators: %s is the title of the overlapping chapter.
						__( 'Overlaps with “%s”', 'godam' ),
						name,
					)
					: __( 'Overlaps with another chapter', 'godam' );
			}
		}
	}

	const canSubmit = trimmedTitle !== '' && startError === '' && endError === '';

	const handleSubmit = () => {
		if ( ! canSubmit ) {
			return;
		}

		onSubmit( { id: editingId, title: trimmedTitle, startSeconds: parsedStart, endSeconds: parsedEnd } );

		if ( ! editingId ) {
			// Reset for the next add (start continues from this chapter's end).
			setTitle( '' );
			setStartInput( formatTimeForInput( parsedEnd ) || '0:00' );
			setEndInput( '' );
		}
	};

	return (
		<div className="godam-ve-chapters__form">
			<div className="godam-ve-chapters__form-head">
				<span className="godam-ve-chapters__form-title">
					{ editingId ? __( 'Edit chapter', 'godam' ) : __( 'Add chapter', 'godam' ) }
				</span>
				{ editingId && (
					<Button
						variant="tertiary"
						className="godam-ve-chapters__form-cancel"
						onClick={ onCancel }
					>
						{ __( 'Cancel', 'godam' ) }
					</Button>
				) }
			</div>

			<VeTextInput
				label={ __( 'Chapter title', 'godam' ) }
				placeholder={ __( 'e.g. Introduction', 'godam' ) }
				value={ title }
				onChange={ setTitle }
			/>

			<div className="godam-ve-chapters__times">
				<VeTextInput
					label={ __( 'Start time', 'godam' ) }
					value={ startInput }
					placeholder="0:00"
					error={ startError || undefined }
					onChange={ setStartInput }
				/>
				<VeTextInput
					label={ __( 'End time', 'godam' ) }
					value={ endInput }
					placeholder={ durationLabel }
					error={ endError || undefined }
					onChange={ setEndInput }
				/>
			</div>

			<Button
				variant="secondary"
				className="godam-ve-chapters__submit"
				icon={ editingId ? undefined : plus }
				iconPosition="left"
				onClick={ handleSubmit }
				disabled={ ! canSubmit }
			>
				{ editingId ? __( 'Save chapter', 'godam' ) : __( 'Add chapter', 'godam' ) }
			</Button>

			<p className="godam-ve-chapters__help">
				{ __( 'Read more about timestamp format', 'godam' ) }{ ' ' }
				<a
					href="https://godam.io/docs/overview/chapters/#h-timestamps-formatting-instructions"
					target="_blank"
					rel="noreferrer"
				>
					{ __( 'here', 'godam' ) }
				</a>
			</p>
		</div>
	);
};

export default ChapterForm;
