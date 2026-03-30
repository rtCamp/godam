/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable import/no-unresolved */
/* eslint-disable @wordpress/no-unsafe-wp-apis */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import {
	useBlockProps,
	InspectorControls,
	InnerBlocks,
	store as blockEditorStore,
} from '@wordpress/block-editor';
import {
	PanelBody,
	SelectControl,
	RangeControl,
	ToggleControl,
	TextControl,
	FormTokenField,
	DatePicker,
	Popover,
	Notice,
	Spinner,
	__experimentalToggleGroupControl as ToggleGroupControl,
	__experimentalToggleGroupControlOption as ToggleGroupControlOption,
	__experimentalToggleGroupControlOptionIcon as ToggleGroupControlOptionIcon,
} from '@wordpress/components';
import { useSelect } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';
import { useMemo, useState } from '@wordpress/element';
import { columns, grid } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import './editor.scss';

const ALLOWED_BLOCKS = [ 'godam/gallery-v2-item' ];
const TEMPLATE = [ [ 'godam/gallery-v2-item', {} ] ];

const formatDisplayDate = ( dateString ) => {
	if ( ! dateString ) {
		return '';
	}

	const date = new Date( dateString );

	return date.toLocaleDateString( 'en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	} );
};

const getStoredDateValue = ( dateString, type ) => {
	if ( ! dateString ) {
		return '';
	}

	const date = new Date( dateString );
	const year = date.getFullYear();
	const month = date.getMonth();
	const day = date.getDate();

	if ( type === 'start' ) {
		return new Date( year, month, day, 0, 0, 0, 0 ).toISOString();
	}

	return new Date( year, month, day, 23, 59, 59, 999 ).toISOString();
};

const getRelativeDate = ( days ) => {
	const date = new Date();
	date.setDate( date.getDate() - days );
	date.setHours( 0, 0, 0, 0 );
	return date.toISOString();
};

const parseIncludeIds = ( include = '' ) =>
	include
		.split( ',' )
		.map( ( value ) => parseInt( value.trim(), 10 ) )
		.filter( ( value ) => ! Number.isNaN( value ) && value > 0 );

const parseIdList = ( value = '' ) =>
	value
		.split( ',' )
		.map( ( item ) => item.trim() )
		.filter( Boolean );

const getVideoThumbnail = ( media ) =>
	media?.meta?.rtgodam_media_video_thumbnail ||
	media?.media_details?.sizes?.medium?.source_url ||
	media?.media_details?.sizes?.thumbnail?.source_url ||
	media?.icon ||
	'';

const normalizeTokenValue = ( value = '' ) => value.trim().toLowerCase();

const getPreviewQueryArgs = ( attributes ) => {
	const {
		count,
		orderby,
		order,
		mediaFolder,
		author,
		dateRange,
		customDateStart,
		customDateEnd,
		include,
	} = attributes;

	const includeIds = parseIncludeIds( include );
	const mediaFolderIds = parseIdList( mediaFolder ).map( ( value ) => parseInt( value, 10 ) ).filter( ( value ) => ! Number.isNaN( value ) && value > 0 );
	const authorIds = parseIdList( author ).map( ( value ) => parseInt( value, 10 ) ).filter( ( value ) => ! Number.isNaN( value ) && value > 0 );
	const queryArgs = {
		per_page: count,
		orderby,
		order,
		status: 'inherit',
		media_type: 'video',
	};

	if ( mediaFolderIds.length ) {
		queryArgs[ 'media-folder' ] = mediaFolderIds.join( ',' );
	}

	if ( authorIds.length ) {
		queryArgs.author = authorIds.join( ',' );
	}

	if ( includeIds.length ) {
		queryArgs.include = includeIds;
	}

	if ( dateRange === '7days' ) {
		queryArgs.after = getRelativeDate( 7 );
	}

	if ( dateRange === '30days' ) {
		queryArgs.after = getRelativeDate( 30 );
	}

	if ( dateRange === '90days' ) {
		queryArgs.after = getRelativeDate( 90 );
	}

	if ( dateRange === 'custom' ) {
		if ( customDateStart ) {
			queryArgs.after = customDateStart;
		}

		if ( customDateEnd ) {
			queryArgs.before = customDateEnd;
		}
	}

	return queryArgs;
};

export default function Edit( { attributes, setAttributes, clientId } ) {
	const {
		mode,
		itemWidth,
		count,
		orderby,
		order,
		viewRatio,
		infiniteScroll,
		mediaFolder,
		author,
		dateRange,
		customDateStart,
		customDateEnd,
		include,
		showTitle,
		layout,
	} = attributes;
	const [ startDatePopoverOpen, setStartDatePopoverOpen ] = useState( false );
	const [ endDatePopoverOpen, setEndDatePopoverOpen ] = useState( false );
	const [ dateError, setDateError ] = useState( '' );

	const { mediaFolders, authors, queryPreviewVideos, hasInnerBlocks } = useSelect(
		( select ) => {
			const coreSelect = select( coreStore );
			const { getBlock } = select( blockEditorStore );
			const block = getBlock( clientId );
			const queryArgs = getPreviewQueryArgs( attributes );

			return {
				mediaFolders: coreSelect.getEntityRecords( 'taxonomy', 'media-folder', { per_page: -1 } ),
				authors: coreSelect.getUsers( { per_page: -1 } ),
				queryPreviewVideos:
					mode === 'query'
						? coreSelect.getEntityRecords( 'postType', 'attachment', queryArgs )
						: [],
				hasInnerBlocks: !! ( block && block.innerBlocks.length ),
			};
		},
		[ attributes, clientId, mode ],
	);

	const blockProps = useBlockProps( {
		className: `godam-gallery-v2 godam-gallery-v2--${ mode }`,
		style: {
			'--godam-gallery-item-width': `${ itemWidth }px`,
			'--godam-gallery-gap': '16px',
		},
	} );

	const mediaFolderOptions = useMemo(
		() =>
			( mediaFolders || [] ).map( ( folder ) => ( {
				id: folder.id.toString(),
				value: folder.name,
			} ) ),
		[ mediaFolders ],
	);

	const authorOptions = useMemo(
		() =>
			( authors || [] ).map( ( item ) => ( {
				id: item.id,
				value: item.name,
			} ) ),
		[ authors ],
	);

	const selectedMediaFolderToken = useMemo(
		() =>
			parseIdList( mediaFolder )
				.map( ( id ) => mediaFolderOptions.find( ( option ) => option.id === id )?.value )
				.filter( Boolean ),
		[ mediaFolder, mediaFolderOptions ],
	);

	const selectedAuthorToken = useMemo(
		() =>
			parseIdList( author )
				.map( ( id ) => authorOptions.find( ( option ) => `${ option.id }` === id )?.value )
				.filter( Boolean ),
		[ author, authorOptions ],
	);

	const mediaFolderSuggestions = useMemo(
		() => mediaFolderOptions.map( ( option ) => option.value ),
		[ mediaFolderOptions ],
	);

	const authorSuggestions = useMemo(
		() => authorOptions.map( ( option ) => option.value ),
		[ authorOptions ],
	);

	const updateMediaFolderToken = ( tokens ) => {
		if ( ! tokens.length ) {
			setAttributes( { mediaFolder: '' } );
			return;
		}

		const selectedIds = tokens
			.map( ( token ) =>
				mediaFolderOptions.find(
					( option ) => normalizeTokenValue( option.value ) === normalizeTokenValue( token ),
				)?.id,
			)
			.filter( Boolean );

		setAttributes( {
			mediaFolder: selectedIds.join( ',' ),
		} );
	};

	const updateAuthorToken = ( tokens ) => {
		if ( ! tokens.length ) {
			setAttributes( { author: '' } );
			return;
		}

		const selectedIds = tokens
			.map( ( token ) =>
				authorOptions.find(
					( option ) => normalizeTokenValue( option.value ) === normalizeTokenValue( token ),
				)?.id,
			)
			.filter( Boolean );

		setAttributes( {
			author: selectedIds.join( ',' ),
		} );
	};

	const previewItems = useMemo( () => {
		if ( mode !== 'query' || ! Array.isArray( queryPreviewVideos ) ) {
			return [];
		}

		return queryPreviewVideos.map( ( video ) => ( {
			id: video.id,
			title: video.title?.rendered || __( 'Untitled video', 'godam' ),
			date: video.date,
			thumbnail: getVideoThumbnail( video ),
		} ) );
	}, [ mode, queryPreviewVideos ] );

	const handleDateChange = ( nextDate, type ) => {
		if ( ! nextDate ) {
			setDateError( '' );
			setAttributes( {
				[ type === 'start' ? 'customDateStart' : 'customDateEnd' ]: '',
			} );
			return;
		}

		const selectedDate = new Date( nextDate );
		selectedDate.setHours( 0, 0, 0, 0 );

		const compareDate = new Date( type === 'start' ? customDateEnd : customDateStart );
		if ( ! Number.isNaN( compareDate.getTime() ) ) {
			compareDate.setHours( 0, 0, 0, 0 );
		}

		if ( ! Number.isNaN( compareDate.getTime() ) ) {
			if ( type === 'start' && selectedDate > compareDate ) {
				setDateError( __( 'Start date cannot be later than end date.', 'godam' ) );
				return;
			}

			if ( type === 'end' && selectedDate < compareDate ) {
				setDateError( __( 'End date cannot be earlier than start date.', 'godam' ) );
				return;
			}
		}

		setDateError( '' );
		setAttributes( {
			[ type === 'start' ? 'customDateStart' : 'customDateEnd' ]: getStoredDateValue( nextDate, type ),
		} );
	};

	return (
		<>
			<InspectorControls>
				<PanelBody title={ __( 'Source', 'godam' ) } initialOpen={ true }>
					<ToggleGroupControl
						__nextHasNoMarginBottom
						isBlock
						label={ __( 'Gallery Source', 'godam' ) }
						value={ mode }
						onChange={ ( value ) => {
							if ( value ) {
								setAttributes( { mode: value } );
							}
						} }
					>
						<ToggleGroupControlOption value="handpicked" label={ __( 'Handpicked', 'godam' ) } />
						<ToggleGroupControlOption value="query" label={ __( 'Query', 'godam' ) } />
					</ToggleGroupControl>
				</PanelBody>

				<PanelBody title={ __( 'Gallery Settings', 'godam' ) } initialOpen={ true }>
					<ToggleGroupControl
						__nextHasNoMarginBottom
						isBlock
						label={ __( 'Layout', 'godam' ) }
						value={ layout }
						onChange={ ( value ) => value && setAttributes( { layout: value } ) }
					>
						<ToggleGroupControlOptionIcon
							icon={ columns }
							label={ __( 'Carousel', 'godam' ) }
							value="carousel"
						/>
						<ToggleGroupControlOptionIcon
							icon={ grid }
							label={ __( 'Grid', 'godam' ) }
							value="grid"
						/>
					</ToggleGroupControl>
					<ToggleGroupControl
						__nextHasNoMarginBottom
						isBlock
						label={ __( 'View Ratio', 'godam' ) }
						value={ viewRatio }
						onChange={ ( value ) => value && setAttributes( { viewRatio: value } ) }
					>
						<ToggleGroupControlOption label="4:3" value="4:3" />
						<ToggleGroupControlOption label="9:16" value="9:16" />
						<ToggleGroupControlOption label="3:4" value="3:4" />
						<ToggleGroupControlOption label="1:1" value="1:1" />
						<ToggleGroupControlOption label="16:9" value="16:9" />
					</ToggleGroupControl>
					<RangeControl
						__nextHasNoMarginBottom
						label={ __( 'Item Width', 'godam' ) }
						value={ itemWidth }
						onChange={ ( value ) => setAttributes( { itemWidth: value } ) }
						min={ 180 }
						max={ 600 }
						step={ 10 }
						help={ __( 'Width of each gallery item in pixels.', 'godam' ) }
					/>
					<ToggleControl
						label={ __( 'Show Video Titles and Dates', 'godam' ) }
						checked={ !! showTitle }
						onChange={ ( value ) => setAttributes( { showTitle: value } ) }
					/>
				</PanelBody>

				{ mode === 'query' && (
					<PanelBody title={ __( 'Query Settings', 'godam' ) } initialOpen={ true }>
						<ToggleControl
							label={ __( 'Enable Infinite Scroll', 'godam' ) }
							checked={ !! infiniteScroll }
							onChange={ ( value ) => setAttributes( { infiniteScroll: value } ) }
						/>
						<RangeControl
							label={ __( 'Number of videos', 'godam' ) }
							value={ count }
							onChange={ ( value ) => setAttributes( { count: value } ) }
							min={ 1 }
							max={ 30 }
						/>
						<div className="godam-gallery-v2__query-row">
							<div className="godam-gallery-v2__query-col">
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
							</div>
							<div className="godam-gallery-v2__query-col">
								<SelectControl
									label={ __( 'Order', 'godam' ) }
									value={ order }
									options={ [
										{ label: __( 'Descending', 'godam' ), value: 'desc' },
										{ label: __( 'Ascending', 'godam' ), value: 'asc' },
									] }
									onChange={ ( value ) => setAttributes( { order: value } ) }
								/>
							</div>
						</div>

						<FormTokenField
							className="media-folder-token-field"
							label={ __( 'Media Folder', 'godam' ) }
							value={ selectedMediaFolderToken }
							suggestions={ mediaFolderSuggestions }
							onChange={ updateMediaFolderToken }
							placeholder={ __( 'Search and select media folders', 'godam' ) }
							__experimentalShowHowTo={ false }
						/>

						<FormTokenField
							className="author-token-field"
							label={ __( 'Author', 'godam' ) }
							value={ selectedAuthorToken }
							suggestions={ authorSuggestions }
							onChange={ updateAuthorToken }
							placeholder={ __( 'Search and select authors', 'godam' ) }
							__experimentalShowHowTo={ false }
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
							onChange={ ( value ) =>
								setAttributes( {
									dateRange: value,
									customDateStart: value === 'custom' ? customDateStart : '',
									customDateEnd: value === 'custom' ? customDateEnd : '',
								} )
							}
						/>
						{ dateRange === 'custom' && (
							<div className="godam-gallery-v2__date-range-picker">
								{ dateError && (
									<Notice status="error" isDismissible={ false }>
										{ dateError }
									</Notice>
								) }
								<div className="godam-gallery-v2__date-field">
									<label htmlFor="godam-gallery-v2-start-date">{ __( 'Start Date', 'godam' ) }</label>
									<button
										id="godam-gallery-v2-start-date"
										type="button"
										className={ `godam-gallery-v2__date-button ${ dateError ? 'has-error' : '' }` }
										onClick={ () => setStartDatePopoverOpen( true ) }
									>
										{ customDateStart ? formatDisplayDate( customDateStart ) : __( 'Select Start Date', 'godam' ) }
									</button>
									{ startDatePopoverOpen && (
										<Popover
											position="bottom left"
											onClose={ () => setStartDatePopoverOpen( false ) }
										>
											<DatePicker
												currentDate={ customDateStart }
												onChange={ ( value ) => {
													handleDateChange( value, 'start' );
													setStartDatePopoverOpen( false );
												} }
												maxDate={ customDateEnd || undefined }
											/>
										</Popover>
									) }
								</div>
								<div className="godam-gallery-v2__date-field">
									<label htmlFor="godam-gallery-v2-end-date">{ __( 'End Date', 'godam' ) }</label>
									<button
										id="godam-gallery-v2-end-date"
										type="button"
										className={ `godam-gallery-v2__date-button ${ dateError ? 'has-error' : '' }` }
										onClick={ () => setEndDatePopoverOpen( true ) }
									>
										{ customDateEnd ? formatDisplayDate( customDateEnd ) : __( 'Select End Date', 'godam' ) }
									</button>
									{ endDatePopoverOpen && (
										<Popover
											position="bottom left"
											onClose={ () => setEndDatePopoverOpen( false ) }
										>
											<DatePicker
												currentDate={ customDateEnd }
												onChange={ ( value ) => {
													handleDateChange( value, 'end' );
													setEndDatePopoverOpen( false );
												} }
												minDate={ customDateStart || undefined }
											/>
										</Popover>
									) }
								</div>
							</div>
						) }
						<TextControl
							label={ __( 'Include Video IDs', 'godam' ) }
							help={ __( 'Comma-separated list of video IDs to include.', 'godam' ) }
							value={ include }
							onChange={ ( value ) => setAttributes( { include: value } ) }
						/>
					</PanelBody>
				) }
			</InspectorControls>

			<div { ...blockProps }>

				{ mode === 'handpicked' && (
					<div
						className={ `godam-gallery-v2__canvas godam-gallery-v2__canvas--${ layout }` }
					>
						<InnerBlocks
							allowedBlocks={ ALLOWED_BLOCKS }
							template={ hasInnerBlocks ? undefined : TEMPLATE }
							orientation={ layout === 'carousel' ? 'horizontal' : 'vertical' }
							renderAppender={ InnerBlocks.ButtonBlockAppender }
						/>
					</div>
				) }

				{ mode === 'query' && (
					<div
						className={ `godam-gallery-v2__canvas godam-gallery-v2__canvas--${ layout }` }
					>
						{ queryPreviewVideos === null && (
							<div className="godam-gallery-v2__state godam-gallery-v2__state--loading">
								<Spinner />
								<span>{ __( 'Loading matching videos…', 'godam' ) }</span>
							</div>
						) }

						{ Array.isArray( queryPreviewVideos ) && queryPreviewVideos.length === 0 && (
							<div className="godam-gallery-v2__state">
								<strong>{ __( 'No videos found', 'godam' ) }</strong>
								<p>{ __( 'Try changing the selected folder, author, dates, or include IDs.', 'godam' ) }</p>
							</div>
						) }

						{ Array.isArray( previewItems ) && previewItems.length > 0 && (
							<div className="godam-gallery-v2__query-list">
								{ previewItems.map( ( video ) => (
									<div
										className={ `godam-gallery-v2__query-item godam-gallery-v2__query-item--ratio-${ viewRatio.replace( ':', '-' ) }` }
										key={ video.id }
									>
										<div className="godam-gallery-v2__query-thumb">
											{ video.thumbnail ? (
												<img src={ video.thumbnail } alt={ video.title } />
											) : (
												<span>{ __( 'GoDAM Video', 'godam' ) }</span>
											) }
										</div>
										{ showTitle && (
											<div className="godam-gallery-v2__query-meta">
												<strong>{ video.title }</strong>
												<span>{ formatDisplayDate( video.date ) }</span>
											</div>
										) }
									</div>
								) ) }
							</div>
						) }
					</div>
				) }
			</div>
		</>
	);
}
