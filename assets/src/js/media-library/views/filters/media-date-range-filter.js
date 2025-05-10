
/* global moment, jQuery */

let MediaDateRangeFilter = wp?.media?.View;

const $ = jQuery;

MediaDateRangeFilter = MediaDateRangeFilter?.extend( {

	tagName: 'input',
	id: 'media-date-range-filter',

	events: {
		'apply.daterangepicker': 'updateFilter',
		'show.daterangepicker': 'updatePickerPosition',
		'cancel.daterangepicker': 'clearFilter',
	},

	/**
	 * update the top position of picker so it does not look out of place.
	 */
	updatePickerPosition() {
		const daterangepickerElement = this.$el.data( 'daterangepicker' ).container;
		const currentTop = parseInt( daterangepickerElement.css( 'top' ), 10 );
		const newTop = currentTop - 30;
		daterangepickerElement.css( 'top', newTop + 'px' );
	},

	updateFilter() {
		const dateRangePicker = this.$el.data( 'daterangepicker' );

		if ( ! dateRangePicker ) {
			return;
		}

		const startDate = dateRangePicker.startDate.format( 'YYYY-MM-DD' );
		const endDate = dateRangePicker.endDate.format( 'YYYY-MM-DD' );

		/**
		 * Create a date query based on the selected date range.
		 */
		const dateQuery = {
			inclusive: true,
		};

		if ( startDate ) {
			dateQuery.after = startDate;
		}
		if ( endDate ) {
			dateQuery.before = endDate;
		}

		this.model.set( {
			date_query: dateQuery,
		} );

		// update the input value to show the selected date range.
		this.$el.val( dateRangePicker.chosenLabel );
	},

	clearFilter() {
		// set it at intial date range.
		this.model.set( 'date_query', undefined );

		this.$el.data( 'daterangepicker' ).setStartDate( moment() );
		this.$el.data( 'daterangepicker' ).setEndDate( moment() );
		this.$el.val( 'Date Range' );
	},

	render() {
		// Call the parent render method
		wp.media.View.prototype.render.apply( this, arguments );

		this.$el.daterangepicker(
			{
				locale: {
					cancelLabel: 'Clear',
				},
				ranges: {
					Today: [ moment(), moment() ],
					Yesterday: [ moment().subtract( 1, 'days' ), moment().subtract( 1, 'days' ) ],
					'Last 7 Days': [ moment().subtract( 6, 'days' ), moment() ],
					'Last 30 Days': [ moment().subtract( 29, 'days' ), moment() ],
					'This Month': [ moment().startOf( 'month' ), moment().endOf( 'month' ) ],
					'Last Month': [ moment().subtract( 1, 'month' ).startOf( 'month' ), moment().subtract( 1, 'month' ).endOf( 'month' ) ],
				},
				autoUpdateInput: false,
			},
		);

		this.$el.val( 'Date Range' );

		// Add "Clear" button inside the main dropdown

		const rangesContainer = this.$el.data( 'daterangepicker' ).container.find( '.ranges ul' );

		const clearButton = $( '<button>' )
			.text( 'Clear' )
			.addClass( 'btn btn-sm btn-light daterangepicker-clear' )
			.css( {
				width: '140px',
				padding: '8px',
				textAlign: 'center',
				background: '#f8f9fa',
				border: '1px solid #ddd',
				cursor: 'pointer',
				fontSize: '12px',
				fontWeight: '600',
			} )
			.on( 'click', () => {
				this.clearFilter();
				this.$el.data( 'daterangepicker' ).hide();
			} );

		// Append the button inside the main container
		rangesContainer.append( clearButton );

		return this;
	},
} );

export default MediaDateRangeFilter;
