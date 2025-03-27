
/* global moment */

let MediaDateRangeFilter = wp?.media?.View;

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

		return this;
	},
} );

export default MediaDateRangeFilter;
