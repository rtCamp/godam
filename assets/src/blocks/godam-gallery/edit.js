/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { useBlockProps, InspectorControls } from '@wordpress/block-editor';
import {
	PanelBody,
	SelectControl,
	RangeControl,
	ToggleControl,
	TextControl,
	DatePicker,
	Popover,
	Notice,
} from '@wordpress/components';
import { useSelect } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';
import { useState } from '@wordpress/element';

/**
 * Internal dependencies
 */
import './editor.scss';

/**
 * The edit function describes the structure of your block in the context of the
 * editor. This represents what the editor will render when the block is used.
 *
 * @param {Object}   props               Block props.
 * @param {Object}   props.attributes    Block attributes.
 * @param {Function} props.setAttributes Function to set block attributes.
 * @return {WPElement} Element to render.
 */
export default function Edit( { attributes, setAttributes } ) {
	const {
		columns,
		count,
		orderby,
		order,
		infiniteScroll,
		category,
		tag,
		author,
		dateRange,
		customDateStart,
		customDateEnd,
		include,
		search,
		showTitle,
		layout,
		engagements,
	} = attributes;
	const blockProps = useBlockProps();

	// Add state for date picker popovers
	const [ startDatePopoverOpen, setStartDatePopoverOpen ] = useState( false );
	const [ endDatePopoverOpen, setEndDatePopoverOpen ] = useState( false );
	const [ dateError, setDateError ] = useState( '' );

	// Fetch categories and tags
	const categories = useSelect( ( select ) => {
		return select( coreStore ).getEntityRecords( 'taxonomy', 'category', { per_page: -1 } );
	}, [] );

	const tags = useSelect( ( select ) => {
		return select( coreStore ).getEntityRecords( 'taxonomy', 'post_tag', { per_page: -1 } );
	}, [] );

	// Fetch authors
	const authors = useSelect( ( select ) => {
		return select( coreStore ).getUsers( { per_page: -1 } );
	}, [] );

	// Add this helper function at the top of your file
	const getFormattedDate = () => {
		const today = new Date();
		return today.toLocaleDateString( 'en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
		} );
	};

	// Generate sample video containers
	const GoDAMVideos = Array.from( { length: count }, ( _, i ) => {
		if ( layout === 'list' ) {
			return (
				<div className="godam-editor-video-item godam-editor-list-item" key={ i }>
					<div className="godam-editor-video-thumbnail">
						<span className="godam-editor-video-label">
							{ __( 'GoDAM Video', 'godam' ) }
						</span>
					</div>
					<div className="godam-editor-video-info">
						<div className="godam-editor-video-title">
							{ __( 'Title', 'godam' ) } { i + 1 }
						</div>
						<div className="godam-editor-video-date">
							{ getFormattedDate() }
						</div>
					</div>
				</div>
			);
		}

		// Grid layout (default)
		return (
			<div className="godam-editor-video-item" key={ i }>
				<div className="godam-editor-video-thumbnail">
					<span className="godam-editor-video-label">
						{ __( 'GoDAM Video', 'godam' ) }
					</span>
				</div>
			</div>
		);
	} );

	// Add this helper function at the top of your file
	const formatDateForDisplay = ( dateString ) => {
		if ( ! dateString ) {
			return '';
		}
		const date = new Date( dateString );
		return date.toLocaleDateString( 'en-US', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
		} );
	};

	const formatDateForStorage = ( dateString, type ) => {
		if ( ! dateString ) {
			return '';
		}
		const date = new Date( dateString );

		// Create a new date object with the local date components
		const year = date.getFullYear();
		const month = date.getMonth();
		const day = date.getDate();

		// Create new date objects for start and end times
		let formattedDate;
		if ( type === 'start' ) {
			// Set start date to beginning of day (00:00:00) in local time
			formattedDate = new Date( year, month, day, 0, 0, 0, 0 );
		} else {
			// Set end date to end of day (23:59:59) in local time
			formattedDate = new Date( year, month, day, 23, 59, 59, 999 );
		}

		return formattedDate.toISOString();
	};

	// Update the handleDateChange function
	const handleDateChange = ( date, type ) => {
		if ( ! date ) {
			setAttributes( {
				[ type === 'start' ? 'customDateStart' : 'customDateEnd' ]: '',
			} );
			return;
		}

		// Create date objects and set them to start of day for comparison
		const newDate = new Date( date );
		newDate.setHours( 0, 0, 0, 0 );

		const otherDate = type === 'start' ? new Date( customDateEnd ) : new Date( customDateStart );
		if ( otherDate ) {
			otherDate.setHours( 0, 0, 0, 0 );
		}

		// Compare dates without time component
		if ( newDate && otherDate ) {
			if ( type === 'start' && newDate > otherDate ) {
				setDateError( __( 'Start date cannot be later than end date', 'godam' ) );
				return;
			}
			if ( type === 'end' && newDate < otherDate ) {
				setDateError( __( 'End date cannot be earlier than start date', 'godam' ) );
				return;
			}
		}

		setDateError( '' );
		setAttributes( {
			[ type === 'start' ? 'customDateStart' : 'customDateEnd' ]: formatDateForStorage( date, type ),
		} );
	};

	return (
		<>
			<InspectorControls>
				<PanelBody title={ __( 'Gallery Settings', 'godam' ) }>
					<ToggleControl
						label={ __( 'Enable Infinite Scroll', 'godam' ) }
						checked={ !! infiniteScroll }
						onChange={ ( value ) => setAttributes( { infiniteScroll: value } ) }
					/>
					{ layout === 'grid' && (
						<>
							<ToggleControl
								label={ __( 'Show Video Titles and Dates', 'godam' ) }
								checked={ !! showTitle }
								onChange={ ( value ) => setAttributes( { showTitle: value } ) }
							/>
						</>
					) }
					<ToggleControl
						label={ __( 'Enable Likes & Comments', 'godam' ) }
						checked={ !! engagements }
						onChange={ ( value ) => setAttributes( { engagements: value } ) }
						help={ __( 'Engagement will only be visible for transcoded videos', 'godam' ) }
					/>
					<SelectControl
						label={ __( 'Layout', 'godam' ) }
						value={ layout }
						options={ [
							{ label: __( 'Grid', 'godam' ), value: 'grid' },
							{ label: __( 'List', 'godam' ), value: 'list' },
						] }
						onChange={ ( value ) => {
							setAttributes( {
								layout: value,
								columns: value === 'list' ? 1 : 3,
								showTitle: value === 'list' ? true : showTitle,
							} );
						} }
					/>
					{ layout === 'grid' && (
						<RangeControl
							label={ __( 'Number of columns', 'godam' ) }
							value={ columns }
							onChange={ ( value ) => setAttributes( { columns: value } ) }
							min={ 1 }
							max={ 6 }
						/>
					) }
					<RangeControl
						label={ __( 'Number of videos', 'godam' ) }
						value={ count }
						onChange={ ( value ) => setAttributes( { count: value } ) }
						min={ 1 }
						max={ 30 }
					/>
					<SelectControl
						label={ __( 'Order by', 'godam' ) }
						value={ orderby }
						options={ [
							{ label: __( 'Date', 'godam' ), value: 'date' },
							{ label: __( 'Title', 'godam' ), value: 'title' },
							{ label: __( 'Duration', 'godam' ), value: 'duration' },
							{ label: __( 'Size', 'godam' ), value: 'size' },
						] }
						onChange={ ( value ) => setAttributes( { orderby: value } ) }
					/>
					<SelectControl
						label={ __( 'Order', 'godam' ) }
						value={ order }
						options={ [
							{ label: __( 'Descending', 'godam' ), value: 'DESC' },
							{ label: __( 'Ascending', 'godam' ), value: 'ASC' },
						] }
						onChange={ ( value ) => setAttributes( { order: value } ) }
					/>
					<SelectControl
						label={ __( 'Category', 'godam' ) }
						value={ category }
						options={ [
							{ label: __( 'All Categories', 'godam' ), value: '' },
							...( categories || [] ).map( ( cat ) => ( {
								label: cat.name,
								value: cat.id.toString(),
							} ) ),
						] }
						onChange={ ( value ) => setAttributes( { category: value } ) }
					/>
					<SelectControl
						label={ __( 'Tag', 'godam' ) }
						value={ tag }
						options={ [
							{ label: __( 'All Tags', 'godam' ), value: '' },
							...( tags || [] ).map( ( postTag ) => ( {
								label: postTag.name,
								value: postTag.id.toString(),
							} ) ),
						] }
						onChange={ ( value ) => setAttributes( { tag: value } ) }
					/>
					<SelectControl
						label={ __( 'Author', 'godam' ) }
						value={ author }
						options={ [
							{ label: __( 'All Authors', 'godam' ), value: 0 },
							...( authors || [] ).map( ( postAuthor ) => ( {
								label: postAuthor.name,
								value: postAuthor.id,
							} ) ),
						] }
						onChange={ ( value ) => setAttributes( { author: value } ) }
					/>
					<SelectControl
						label={ __( 'Date Range', 'godam' ) }
						value={ dateRange }
						options={ [
							{ label: __( 'All Time', 'godam' ), value: '' },
							{ label: __( 'Last 7 Days', 'godam' ), value: '7days' },
							{ label: __( 'Last 30 Days', 'godam' ), value: '30days' },
							{ label: __( 'Last 90 Days', 'godam' ), value: '90days' },
							{ label: __( 'Custom Range', 'godam' ), value: 'custom' },
						] }
						onChange={ ( value ) => setAttributes( { dateRange: value } ) }
					/>
					{ dateRange === 'custom' && (
						<div className="godam-date-range-picker">
							{ dateError && (
								<Notice
									status="error"
									isDismissible={ false }
									className="godam-date-error"
								>
									{ dateError }
								</Notice>
							) }
							<div className="godam-date-field">
								<label htmlFor="godam-start-date">{ __( 'Start Date', 'godam' ) }</label>
								<button
									id="godam-start-date"
									type="button"
									className={ `godam-date-button ${ dateError ? 'has-error' : '' }` }
									onClick={ () => setStartDatePopoverOpen( true ) }
								>
									{ customDateStart ? formatDateForDisplay( customDateStart ) : __( 'Select Start Date', 'godam' ) }
								</button>
								{ startDatePopoverOpen && (
									<Popover
										position="bottom left"
										onClose={ () => setStartDatePopoverOpen( false ) }
									>
										<DatePicker
											currentDate={ customDateStart }
											onChange={ ( date ) => {
												handleDateChange( date, 'start' );
												setStartDatePopoverOpen( false );
											} }
											maxDate={ customDateEnd }
										/>
									</Popover>
								) }
							</div>

							<div className="godam-date-field">
								<label htmlFor="godam-end-date">{ __( 'End Date', 'godam' ) }</label>
								<button
									id="godam-end-date"
									type="button"
									className={ `godam-date-button ${ dateError ? 'has-error' : '' }` }
									onClick={ () => setEndDatePopoverOpen( true ) }
								>
									{ customDateEnd ? formatDateForDisplay( customDateEnd ) : __( 'Select End Date', 'godam' ) }
								</button>
								{ endDatePopoverOpen && (
									<Popover
										position="bottom left"
										onClose={ () => setEndDatePopoverOpen( false ) }
									>
										<DatePicker
											currentDate={ customDateEnd }
											onChange={ ( date ) => {
												handleDateChange( date, 'end' );
												setEndDatePopoverOpen( false );
											} }
											minDate={ customDateStart }
										/>
									</Popover>
								) }
							</div>
						</div>
					) }
					<TextControl
						label={ __( 'Include Video IDs', 'godam' ) }
						help={ __( 'Comma-separated list of video IDs to include', 'godam' ) }
						value={ include }
						onChange={ ( value ) => setAttributes( { include: value } ) }
					/>
					<TextControl
						label={ __( 'Search', 'godam' ) }
						help={ __( 'Search in video titles and descriptions', 'godam' ) }
						value={ search }
						onChange={ ( value ) => setAttributes( { search: value } ) }
					/>
				</PanelBody>
			</InspectorControls>
			<div { ...blockProps }>
				<div className={ `godam-editor-video-gallery layout-${ layout } ${ layout === 'grid' ? `columns-${ columns }` : '' }` }>
					{ GoDAMVideos }
				</div>
			</div>
		</>
	);
}
