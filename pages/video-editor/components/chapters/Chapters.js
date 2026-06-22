/**
 * External dependencies
 */
import { useSelector, useDispatch } from 'react-redux';
import { v4 as uuidv4 } from 'uuid';

/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';
import { Button } from '@wordpress/components';
import { edit, trash } from '@wordpress/icons';
import { useState } from '@wordpress/element';

/**
 * Internal dependencies
 */
import ChapterForm from './ChapterForm';
import { addChapter, removeChapter, updateChapterField } from '../../redux/slice/videoSlice';
import { formatClock, getChapterRows } from './utils';

/**
 * Chapters tab panel: a header, the list of chapters (clickable cards that load
 * into the form for editing, each with a delete action), and the add / edit
 * form. Each chapter has an editable start and end; chapters may not overlap.
 *
 * @param {Object}   props                    Props.
 * @param {number}   props.duration           Video duration, in seconds.
 * @param {Function} props.formatTimeForInput Formats seconds to the editable time string.
 * @param {Function} [props.onSelectChapter]  Seeks the player to a chapter's start.
 * @return {JSX.Element} The Chapters panel.
 */
const Chapters = ( { duration, formatTimeForInput, onSelectChapter } ) => {
	const loading = useSelector( ( state ) => state.videoReducer.loading );
	const chapters = useSelector( ( state ) => state.videoReducer.chapters );
	const dispatch = useDispatch();

	const [ editingId, setEditingId ] = useState( null );

	const rows = getChapterRows( chapters, duration );
	const editingRow = rows.find( ( row ) => row.id === editingId ) || null;

	const handleEdit = ( row ) => {
		setEditingId( row.id );
		onSelectChapter?.( row.startSeconds );
	};

	const handleDelete = ( id ) => {
		if ( editingId === id ) {
			setEditingId( null );
		}
		dispatch( removeChapter( { id } ) );
	};

	const handleSubmit = ( { id, title, startSeconds, endSeconds } ) => {
		const fields = {
			text: title,
			startTime: String( startSeconds ),
			originalTime: formatTimeForInput( startSeconds ) || '0:00',
			endTime: String( endSeconds ),
			originalEndTime: formatTimeForInput( endSeconds ) || '0:00',
		};

		if ( id ) {
			Object.entries( fields ).forEach( ( [ field, value ] ) => {
				dispatch( updateChapterField( { id, field, value } ) );
			} );
			setEditingId( null );
		} else {
			dispatch( addChapter( { id: uuidv4(), ...fields } ) );
		}
	};

	return (
		<div className="godam-ve-chapters">
			<div className="godam-ve-chapters__head">
				<h2 className="godam-ve-chapters__title">
					{ sprintf(
						// translators: %d is the number of chapters.
						__( 'Chapters (%d)', 'godam' ),
						chapters.length,
					) }
				</h2>
			</div>

			{ loading && (
				<div className="loading-skeleton">
					<div className="skeleton-container skeleton-container-short">
						<div className="skeleton-header"></div>
					</div>
					<div className="skeleton-container skeleton-container-short">
						<div className="skeleton-header"></div>
					</div>
					<div className="skeleton-container skeleton-container-short">
						<div className="skeleton-header"></div>
					</div>
				</div>
			) }

			{ ! loading && rows.length > 0 && (
				<ul className="godam-ve-chapters__list">
					{ rows.map( ( row, index ) => {
						// The chapter being edited is replaced by the edit form in place.
						if ( editingId === row.id ) {
							return (
								<li key={ row.id } className="godam-ve-chapters__edit-row">
									<ChapterForm
										rows={ rows }
										duration={ duration }
										formatTimeForInput={ formatTimeForInput }
										editingRow={ editingRow }
										onSubmit={ handleSubmit }
										onCancel={ () => setEditingId( null ) }
									/>
								</li>
							);
						}

						return (
							<li key={ row.id } className="godam-ve-chapter-row">
								<Button
									className="godam-ve-chapter-row__main"
									onClick={ () => handleEdit( row ) }
								>
									<span className="godam-ve-chapter-row__swatch" aria-hidden="true" />
									<span className="godam-ve-chapter-row__text">
										<span className="godam-ve-chapter-row__name">
											{ row.text?.trim() || sprintf(
												// translators: %d is the chapter position in the list.
												__( 'Chapter %d', 'godam' ),
												index + 1,
											) }
										</span>
										<span className="godam-ve-chapter-row__meta">
											{ formatClock( row.startSeconds ) } - { formatClock( row.endSeconds ) }
										</span>
									</span>
								</Button>
								<Button
									className="godam-ve-chapter-row__edit"
									icon={ edit }
									label={ __( 'Edit chapter', 'godam' ) }
									onClick={ () => handleEdit( row ) }
								/>
								<Button
									className="godam-ve-chapter-row__delete"
									icon={ trash }
									isDestructive
									label={ __( 'Delete chapter', 'godam' ) }
									onClick={ () => handleDelete( row.id ) }
								/>
							</li>
						);
					} ) }
				</ul>
			) }

			{ /* The bottom form adds a new chapter; editing happens inline above. */ }
			{ ! loading && ! editingId && (
				<ChapterForm
					rows={ rows }
					duration={ duration }
					formatTimeForInput={ formatTimeForInput }
					editingRow={ null }
					onSubmit={ handleSubmit }
					onCancel={ () => setEditingId( null ) }
				/>
			) }
		</div>
	);
};

export default Chapters;
