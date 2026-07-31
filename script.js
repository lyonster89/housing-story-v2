"use strict";

/*
 * Housing Pressure Narrative Visualization
 *
 * This file performs four main jobs:
 * 1. Loads the processed annual housing data.
 * 2. Calculates derived values such as new households and mortgage payments.
 * 3. Draws the four D3 scenes.
 * 4. Redraws the charts when the browser window changes size.
 */

const DATA_FILE_PATH =
  "data/processed/housing_pressure_last_10_years.json";

const LOAN_AMOUNT_DOLLARS = 200000;
const LOAN_TERM_YEARS = 30;
const MONTHS_PER_YEAR = 12;

let preparedHousingData = [];
let resizeTimer;

/*
 * Each explorer metric defines:
 * - key: field name in the prepared data
 * - label: wording shown beside the checkbox
 * - formatter: formatting used in the tooltip
 */
const explorerMetrics = [
  {
    key: "total_households_thousands",
    label: "Total households",
    formatter: value => `${d3.format(",.0f")(value)} thousand`
  },
  {
    key: "new_households_thousands",
    label: "New households",
    formatter: value => `${d3.format(",.0f")(value)} thousand`
  },
  {
    key: "median_household_income_dollars",
    label: "Median household income",
    formatter: value => d3.format("$,.0f")(value)
  },
  {
    key: "mortgage_rate_percent",
    label: "Mortgage APR",
    formatter: value => `${d3.format(".2f")(value)}%`
  },
  {
    key: "monthly_mortgage_payment_dollars",
    label: "$200K monthly mortgage payment",
    formatter: value => d3.format("$,.0f")(value)
  },
  {
    key: "mortgage_payment_percent_of_income",
    label: "$200K mortgage as % of income",
    formatter: value => `${d3.format(".1f")(value)}%`
  }
];

const explorerLineColors = [
  "#1d6655",
  "#b66b35",
  "#526d95",
  "#8a5b82",
  "#a84a43",
  "#6e7539"
];

/*
 * Wait until the HTML document is ready, then load the data.
 */
document.addEventListener("DOMContentLoaded", initializeWebsite);

/*
 * Load the JSON file and start every scene.
 */
async function initializeWebsite() {
  displayLoadingMessages();

  try {
    const rawHousingData = await d3.json(DATA_FILE_PATH);

    validateHousingData(rawHousingData);

    preparedHousingData = prepareHousingData(rawHousingData);

    createMetricCheckboxes();
    renderAllScenes();
  } catch (error) {
    console.error("Housing data could not be loaded:", error);
    displayDataError(error);
  }
}

/*
 * Confirm that the loaded file is an array with the required core fields.
 */
function validateHousingData(rawHousingData) {
  if (!Array.isArray(rawHousingData) || rawHousingData.length === 0) {
    throw new Error("The housing JSON file is empty or invalid.");
  }

  const requiredFields = [
    "year",
    "total_households_thousands",
    "housing_completions_thousands",
    "mortgage_rate_percent"
  ];

  requiredFields.forEach(requiredField => {
    if (!(requiredField in rawHousingData[0])) {
      throw new Error(
        `The required field "${requiredField}" is missing from the data.`
      );
    }
  });
}

/*
 * Add every calculated field needed by the scenes.
 *
 * Input:
 * rawHousingData - annual records loaded from JSON
 *
 * Output:
 * a new array containing both source values and derived values
 */
function prepareHousingData(rawHousingData) {
  const sortedData = [...rawHousingData].sort(
    (firstRecord, secondRecord) =>
      firstRecord.year - secondRecord.year
  );

  return sortedData.map((currentRecord, recordIndex) => {
    const previousRecord =
      recordIndex > 0 ? sortedData[recordIndex - 1] : null;

    /*
     * Total households are reported in thousands.
     * Subtracting consecutive years produces new households in thousands.
     */
    const newHouseholdsThousands =
      previousRecord &&
      isFiniteNumber(currentRecord.total_households_thousands) &&
      isFiniteNumber(previousRecord.total_households_thousands)
        ? currentRecord.total_households_thousands -
          previousRecord.total_households_thousands
        : null;

    const monthlyMortgagePayment =
      calculateMonthlyMortgagePayment(
        LOAN_AMOUNT_DOLLARS,
        currentRecord.mortgage_rate_percent,
        LOAN_TERM_YEARS
      );

    const previousMonthlyMortgagePayment =
      previousRecord
        ? calculateMonthlyMortgagePayment(
            LOAN_AMOUNT_DOLLARS,
            previousRecord.mortgage_rate_percent,
            LOAN_TERM_YEARS
          )
        : null;

    const mortgagePaymentGrowthPercent =
      isFiniteNumber(monthlyMortgagePayment) &&
      isFiniteNumber(previousMonthlyMortgagePayment)
        ? calculatePercentChange(
            monthlyMortgagePayment,
            previousMonthlyMortgagePayment
          )
        : null;

    const annualMortgagePayment =
      isFiniteNumber(monthlyMortgagePayment)
        ? monthlyMortgagePayment * MONTHS_PER_YEAR
        : null;

    const mortgagePaymentPercentOfIncome =
      isFiniteNumber(annualMortgagePayment) &&
      isFiniteNumber(currentRecord.median_household_income_dollars)
        ? (
            annualMortgagePayment /
            currentRecord.median_household_income_dollars
          ) * 100
        : null;

    const housingGapThousands =
      isFiniteNumber(currentRecord.housing_completions_thousands) &&
      isFiniteNumber(newHouseholdsThousands)
        ? currentRecord.housing_completions_thousands -
          newHouseholdsThousands
        : null;

    return {
      ...currentRecord,
      new_households_thousands: newHouseholdsThousands,
      housing_gap_thousands: housingGapThousands,
      market_kept_up:
        isFiniteNumber(housingGapThousands)
          ? housingGapThousands >= 0
          : null,
      monthly_mortgage_payment_dollars: monthlyMortgagePayment,
      annual_mortgage_payment_dollars: annualMortgagePayment,
      mortgage_payment_growth_percent: mortgagePaymentGrowthPercent,
      mortgage_payment_percent_of_income:
        mortgagePaymentPercentOfIncome
    };
  });
}

/*
 * Calculate the monthly principal-and-interest payment on a fixed-rate loan.
 *
 * Inputs:
 * loanAmountDollars - original loan principal
 * annualInterestRatePercent - annual percentage rate
 * loanTermYears - number of years in the loan
 *
 * Output:
 * monthly principal-and-interest payment
 */
function calculateMonthlyMortgagePayment(
  loanAmountDollars,
  annualInterestRatePercent,
  loanTermYears
) {
  if (
    !isFiniteNumber(loanAmountDollars) ||
    !isFiniteNumber(annualInterestRatePercent) ||
    !isFiniteNumber(loanTermYears)
  ) {
    return null;
  }

  const monthlyInterestRate =
    annualInterestRatePercent / 100 / MONTHS_PER_YEAR;

  const numberOfMonthlyPayments =
    loanTermYears * MONTHS_PER_YEAR;

  /*
   * A zero-interest loan is a special case because the standard formula
   * would divide by zero.
   */
  if (monthlyInterestRate === 0) {
    return loanAmountDollars / numberOfMonthlyPayments;
  }

  const compoundRate =
    Math.pow(1 + monthlyInterestRate, numberOfMonthlyPayments);

  return (
    loanAmountDollars *
    (
      monthlyInterestRate * compoundRate
    ) /
    (
      compoundRate - 1
    )
  );
}

/*
 * Return percentage change from the previous value to the current value.
 */
function calculatePercentChange(currentValue, previousValue) {
  if (
    !isFiniteNumber(currentValue) ||
    !isFiniteNumber(previousValue) ||
    previousValue === 0
  ) {
    return null;
  }

  return ((currentValue - previousValue) / previousValue) * 100;
}

/*
 * Check whether a value is a real finite number.
 */
function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

/*
 * Draw every scene from the prepared data.
 */
function renderAllScenes() {
  createSceneOneChart(preparedHousingData);
  createSceneTwoChart(preparedHousingData);
  createSceneThreeChart(preparedHousingData);
  createSceneFourChart(preparedHousingData);
}

/*
 * Display temporary loading text while the JSON file is being read.
 */
function displayLoadingMessages() {
  document.querySelectorAll(".chart-container").forEach(container => {
    container.innerHTML =
      '<div class="loading-message">Loading housing data…</div>';
  });
}

/*
 * Display a clear error when the website cannot load the JSON file.
 */
function displayDataError(error) {
  document.querySelectorAll(".chart-container").forEach(container => {
    container.innerHTML =
      `<div class="error-message">
        The chart data could not be loaded.<br>
        ${error.message}
      </div>`;
  });
}

/*
 * Remove an old chart and return its current dimensions.
 */
function prepareChartContainer(containerId, minimumWidth = 320) {
  const chartContainer = document.getElementById(containerId);

  if (!chartContainer) {
    throw new Error(`Chart container "${containerId}" was not found.`);
  }

  chartContainer.innerHTML = "";

  const width = Math.max(chartContainer.clientWidth, minimumWidth);
  const height = Math.max(chartContainer.clientHeight, 430);

  return {
    chartContainer,
    width,
    height
  };
}

/*
 * Create the root SVG and translated plotting group.
 */
function createChartFrame(
  chartContainer,
  width,
  height,
  margin
) {
  const svg = d3
    .select(chartContainer)
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img");

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const plotGroup = svg
    .append("g")
    .attr(
      "transform",
      `translate(${margin.left}, ${margin.top})`
    );

  return {
    svg,
    plotGroup,
    innerWidth,
    innerHeight
  };
}

/*
 * Scene 1:
 * Compare newly formed households with completed housing units.
 */
function createSceneOneChart(data) {
  const sceneData = data.filter(
    record =>
      isFiniteNumber(record.new_households_thousands) &&
      isFiniteNumber(record.housing_completions_thousands)
  );

  const {
    chartContainer,
    width,
    height
  } = prepareChartContainer("scene-1-chart");

  const margin = {
    top: 30,
    right: 20,
    bottom: 65,
    left: 70
  };

  const {
    plotGroup,
    innerWidth,
    innerHeight
  } = createChartFrame(
    chartContainer,
    width,
    height,
    margin
  );

  const yearScale = d3
    .scaleBand()
    .domain(sceneData.map(record => record.year))
    .range([0, innerWidth])
    .padding(0.2);

  const seriesScale = d3
    .scaleBand()
    .domain(["newHouseholds", "housingCompletions"])
    .range([0, yearScale.bandwidth()])
    .padding(0.08);

  const maximumValue = d3.max(
    sceneData,
    record => Math.max(
      record.new_households_thousands,
      record.housing_completions_thousands
    )
  );

  const valueScale = d3
    .scaleLinear()
    .domain([0, maximumValue * 1.12])
    .nice()
    .range([innerHeight, 0]);

  addHorizontalGrid(plotGroup, valueScale, innerWidth);

  plotGroup
    .append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0, ${innerHeight})`)
    .call(d3.axisBottom(yearScale));

  plotGroup
    .append("g")
    .attr("class", "axis")
    .call(
      d3.axisLeft(valueScale)
        .ticks(6)
        .tickFormat(d3.format(",.0f"))
    );

  addAxisLabels(
    plotGroup,
    innerWidth,
    innerHeight,
    "Year",
    "Thousands"
  );

  const groupedData = sceneData.map(record => ({
    year: record.year,
    values: [
      {
        key: "newHouseholds",
        label: "New households",
        value: record.new_households_thousands,
        color: "#1d6655"
      },
      {
        key: "housingCompletions",
        label: "Housing completions",
        value: record.housing_completions_thousands,
        color: "#b66b35"
      }
    ],
    housingGap: record.housing_gap_thousands
  }));

  const yearGroups = plotGroup
    .selectAll(".scene-one-year")
    .data(groupedData)
    .join("g")
    .attr("class", "scene-one-year")
    .attr(
      "transform",
      record => `translate(${yearScale(record.year)}, 0)`
    );

  yearGroups
    .selectAll("rect")
    .data(record => record.values.map(valueRecord => ({
      ...valueRecord,
      year: record.year,
      housingGap: record.housingGap
    })))
    .join("rect")
    .attr("x", valueRecord => seriesScale(valueRecord.key))
    .attr("y", valueRecord => valueScale(valueRecord.value))
    .attr("width", seriesScale.bandwidth())
    .attr(
      "height",
      valueRecord => innerHeight - valueScale(valueRecord.value)
    )
    .attr("rx", 3)
    .attr("fill", valueRecord => valueRecord.color)
    .on("mouseenter", function (event, valueRecord) {
      showTooltip(
        event,
        `<strong>${valueRecord.year}</strong>
         ${valueRecord.label}: ${d3.format(",.0f")(valueRecord.value)} thousand<br>
         Housing gap: ${formatSignedNumber(valueRecord.housingGap)} thousand`
      );
    })
    .on("mousemove", moveTooltip)
    .on("mouseleave", hideTooltip);

  updateSceneOneSummary(sceneData);
}

/*
 * Write the key Scene 1 takeaway below the chart.
 */
function updateSceneOneSummary(sceneData) {
  const summaryElement =
    document.getElementById("scene-1-summary");

  const yearsConstructionDidNotKeepUp = sceneData.filter(
    record => record.market_kept_up === false
  );

  const largestShortfallRecord = d3.least(
    sceneData,
    record => record.housing_gap_thousands
  );

  const latestRecord = sceneData[sceneData.length - 1];

  const latestInterpretation =
    latestRecord.market_kept_up
      ? "completed housing exceeded new household formation"
      : "new household formation exceeded completed housing";

  summaryElement.innerHTML =
    `<h3>What the comparison shows</h3>
     <p>
       Construction failed to keep up in
       <strong>${yearsConstructionDidNotKeepUp.length}</strong>
       of the ${sceneData.length} displayed years.
       The largest shortfall occurred in
       <strong>${largestShortfallRecord.year}</strong>.
       In ${latestRecord.year}, ${latestInterpretation} by
       <strong>${d3.format(",.0f")(
         Math.abs(latestRecord.housing_gap_thousands)
       )} thousand units</strong>.
     </p>`;
}

/*
 * Scene 2:
 * Compare the annual mortgage rate with the monthly payment on a fixed loan.
 */
function createSceneTwoChart(data) {
  const sceneData = data.filter(
    record =>
      isFiniteNumber(record.mortgage_rate_percent) &&
      isFiniteNumber(record.monthly_mortgage_payment_dollars)
  );

  const {
    chartContainer,
    width,
    height
  } = prepareChartContainer("scene-2-chart");

  const margin = {
    top: 35,
    right: 78,
    bottom: 65,
    left: 68
  };

  const {
    plotGroup,
    innerWidth,
    innerHeight
  } = createChartFrame(
    chartContainer,
    width,
    height,
    margin
  );

  const yearScale = d3
    .scaleLinear()
    .domain(d3.extent(sceneData, record => record.year))
    .range([0, innerWidth]);

  const rateScale = d3
    .scaleLinear()
    .domain([
      0,
      d3.max(sceneData, record => record.mortgage_rate_percent) * 1.18
    ])
    .nice()
    .range([innerHeight, 0]);

  const paymentExtent = d3.extent(
    sceneData,
    record => record.monthly_mortgage_payment_dollars
  );

  const paymentScale = d3
    .scaleLinear()
    .domain([
      paymentExtent[0] * 0.92,
      paymentExtent[1] * 1.08
    ])
    .nice()
    .range([innerHeight, 0]);

  addHorizontalGrid(plotGroup, rateScale, innerWidth);

  plotGroup
    .append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0, ${innerHeight})`)
    .call(
      d3.axisBottom(yearScale)
        .ticks(sceneData.length)
        .tickFormat(d3.format("d"))
    );

  plotGroup
    .append("g")
    .attr("class", "axis")
    .call(
      d3.axisLeft(rateScale)
        .ticks(6)
        .tickFormat(value => `${value}%`)
    );

  plotGroup
    .append("g")
    .attr("class", "axis")
    .attr("transform", `translate(${innerWidth}, 0)`)
    .call(
      d3.axisRight(paymentScale)
        .ticks(6)
        .tickFormat(d3.format("$,.0f"))
    );

  addAxisLabels(
    plotGroup,
    innerWidth,
    innerHeight,
    "Year",
    "Mortgage APR"
  );

  plotGroup
    .append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(90)")
    .attr("x", innerHeight / 2)
    .attr("y", -innerWidth - 60)
    .attr("text-anchor", "middle")
    .text("Monthly payment");

  const rateLine = d3
    .line()
    .x(record => yearScale(record.year))
    .y(record => rateScale(record.mortgage_rate_percent))
    .curve(d3.curveMonotoneX);

  const paymentLine = d3
    .line()
    .x(record => yearScale(record.year))
    .y(record =>
      paymentScale(record.monthly_mortgage_payment_dollars)
    )
    .curve(d3.curveMonotoneX);

  plotGroup
    .append("path")
    .datum(sceneData)
    .attr("fill", "none")
    .attr("stroke", "#1d6655")
    .attr("stroke-width", 4)
    .attr("d", rateLine);

  plotGroup
    .append("path")
    .datum(sceneData)
    .attr("fill", "none")
    .attr("stroke", "#b66b35")
    .attr("stroke-width", 4)
    .attr("d", paymentLine);

  addLinePoints(
    plotGroup,
    sceneData,
    record => yearScale(record.year),
    record => rateScale(record.mortgage_rate_percent),
    "#1d6655",
    (event, record) => {
      showTooltip(
        event,
        `<strong>${record.year}</strong>
         Mortgage APR: ${d3.format(".2f")(
           record.mortgage_rate_percent
         )}%<br>
         Monthly payment: ${d3.format("$,.0f")(
           record.monthly_mortgage_payment_dollars
         )}`
      );
    }
  );

  addLinePoints(
    plotGroup,
    sceneData,
    record => yearScale(record.year),
    record => paymentScale(
      record.monthly_mortgage_payment_dollars
    ),
    "#b66b35",
    (event, record) => {
      showTooltip(
        event,
        `<strong>${record.year}</strong>
         Monthly payment: ${d3.format("$,.0f")(
           record.monthly_mortgage_payment_dollars
         )}<br>
         Mortgage APR: ${d3.format(".2f")(
           record.mortgage_rate_percent
         )}%`
      );
    }
  );

  addDirectLineLabel(
    plotGroup,
    sceneData[sceneData.length - 1],
    yearScale,
    rateScale,
    "mortgage_rate_percent",
    "APR",
    "#1d6655",
    -12
  );

  addDirectLineLabel(
    plotGroup,
    sceneData[sceneData.length - 1],
    yearScale,
    paymentScale,
    "monthly_mortgage_payment_dollars",
    "Payment",
    "#b66b35",
    18
  );

  updateSceneTwoSummary(sceneData);
}

/*
 * Write Scene 2's payment-change takeaway.
 */
function updateSceneTwoSummary(sceneData) {
  const summaryElement =
    document.getElementById("scene-2-summary");

  const lowestPaymentRecord = d3.least(
    sceneData,
    record => record.monthly_mortgage_payment_dollars
  );

  const highestPaymentRecord = d3.greatest(
    sceneData,
    record => record.monthly_mortgage_payment_dollars
  );

  const paymentIncrease =
    highestPaymentRecord.monthly_mortgage_payment_dollars -
    lowestPaymentRecord.monthly_mortgage_payment_dollars;

  const paymentIncreasePercent =
    calculatePercentChange(
      highestPaymentRecord.monthly_mortgage_payment_dollars,
      lowestPaymentRecord.monthly_mortgage_payment_dollars
    );

  summaryElement.innerHTML =
    `<h3>The financing effect</h3>
     <p>
       The lowest estimated payment was
       <strong>${d3.format("$,.0f")(
         lowestPaymentRecord.monthly_mortgage_payment_dollars
       )}</strong>
       in ${lowestPaymentRecord.year}. The highest was
       <strong>${d3.format("$,.0f")(
         highestPaymentRecord.monthly_mortgage_payment_dollars
       )}</strong>
       in ${highestPaymentRecord.year}. That is an increase of
       <strong>${d3.format("$,.0f")(paymentIncrease)} per month</strong>,
       or approximately
       <strong>${d3.format(".1f")(paymentIncreasePercent)}%</strong>.
     </p>`;
}

/*
 * Scene 3:
 * Compare income growth and mortgage-payment growth.
 */
function createSceneThreeChart(data) {
  const sceneData = data.filter(
    record =>
      isFiniteNumber(record.income_growth_percent) &&
      isFiniteNumber(record.mortgage_payment_growth_percent)
  );

  const {
    chartContainer,
    width,
    height
  } = prepareChartContainer("scene-3-chart");

  const margin = {
    top: 35,
    right: 28,
    bottom: 65,
    left: 70
  };

  const {
    plotGroup,
    innerWidth,
    innerHeight
  } = createChartFrame(
    chartContainer,
    width,
    height,
    margin
  );

  const yearScale = d3
    .scaleLinear()
    .domain(d3.extent(sceneData, record => record.year))
    .range([0, innerWidth]);

  const combinedValues = sceneData.flatMap(record => [
    record.income_growth_percent,
    record.mortgage_payment_growth_percent
  ]);

  const valueExtent = d3.extent(combinedValues);

  const valueScale = d3
    .scaleLinear()
    .domain([
      Math.min(valueExtent[0] * 1.18, -1),
      Math.max(valueExtent[1] * 1.18, 1)
    ])
    .nice()
    .range([innerHeight, 0]);

  addHorizontalGrid(plotGroup, valueScale, innerWidth);

  plotGroup
    .append("line")
    .attr("class", "zero-line")
    .attr("x1", 0)
    .attr("x2", innerWidth)
    .attr("y1", valueScale(0))
    .attr("y2", valueScale(0));

  plotGroup
    .append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0, ${innerHeight})`)
    .call(
      d3.axisBottom(yearScale)
        .ticks(sceneData.length)
        .tickFormat(d3.format("d"))
    );

  plotGroup
    .append("g")
    .attr("class", "axis")
    .call(
      d3.axisLeft(valueScale)
        .ticks(7)
        .tickFormat(value => `${value}%`)
    );

  addAxisLabels(
    plotGroup,
    innerWidth,
    innerHeight,
    "Year",
    "Year-over-year change"
  );

  const incomeLine = d3
    .line()
    .x(record => yearScale(record.year))
    .y(record => valueScale(record.income_growth_percent))
    .curve(d3.curveMonotoneX);

  const paymentGrowthLine = d3
    .line()
    .x(record => yearScale(record.year))
    .y(record =>
      valueScale(record.mortgage_payment_growth_percent)
    )
    .curve(d3.curveMonotoneX);

  plotGroup
    .append("path")
    .datum(sceneData)
    .attr("fill", "none")
    .attr("stroke", "#1d6655")
    .attr("stroke-width", 4)
    .attr("d", incomeLine);

  plotGroup
    .append("path")
    .datum(sceneData)
    .attr("fill", "none")
    .attr("stroke", "#b66b35")
    .attr("stroke-width", 4)
    .attr("d", paymentGrowthLine);

  addLinePoints(
    plotGroup,
    sceneData,
    record => yearScale(record.year),
    record => valueScale(record.income_growth_percent),
    "#1d6655",
    (event, record) => {
      showTooltip(
        event,
        `<strong>${record.year}</strong>
         Income growth: ${formatSignedPercent(
           record.income_growth_percent
         )}<br>
         Mortgage-payment growth: ${formatSignedPercent(
           record.mortgage_payment_growth_percent
         )}`
      );
    }
  );

  addLinePoints(
    plotGroup,
    sceneData,
    record => yearScale(record.year),
    record => valueScale(
      record.mortgage_payment_growth_percent
    ),
    "#b66b35",
    (event, record) => {
      showTooltip(
        event,
        `<strong>${record.year}</strong>
         Mortgage-payment growth: ${formatSignedPercent(
           record.mortgage_payment_growth_percent
         )}<br>
         Income growth: ${formatSignedPercent(
           record.income_growth_percent
         )}`
      );
    }
  );

  updateSceneThreeSummary(sceneData);
}

/*
 * Write Scene 3's comparison takeaway.
 */
function updateSceneThreeSummary(sceneData) {
  const summaryElement =
    document.getElementById("scene-3-summary");

  const yearsPaymentOutgrewIncome = sceneData.filter(
    record =>
      record.mortgage_payment_growth_percent >
      record.income_growth_percent
  );

  const widestGapRecord = d3.greatest(
    sceneData,
    record =>
      record.mortgage_payment_growth_percent -
      record.income_growth_percent
  );

  const growthGap =
    widestGapRecord.mortgage_payment_growth_percent -
    widestGapRecord.income_growth_percent;

  summaryElement.innerHTML =
    `<h3>Did income keep pace?</h3>
     <p>
       Mortgage-payment growth exceeded income growth in
       <strong>${yearsPaymentOutgrewIncome.length}</strong>
       of the ${sceneData.length} comparable years.
       The widest difference occurred in
       <strong>${widestGapRecord.year}</strong>, when payment growth
       exceeded income growth by
       <strong>${d3.format(".1f")(growthGap)} percentage points</strong>.
     </p>`;
}

/*
 * Create Scene 4's checkbox controls.
 */
function createMetricCheckboxes() {
  const checkboxContainer =
    document.getElementById("metric-checkboxes");

  checkboxContainer.innerHTML = "";

  explorerMetrics.forEach((metric, metricIndex) => {
    const labelElement = document.createElement("label");
    labelElement.className = "metric-checkbox";

    const checkboxElement = document.createElement("input");
    checkboxElement.type = "checkbox";
    checkboxElement.value = metric.key;
    checkboxElement.checked = metricIndex < 2;

    checkboxElement.addEventListener(
      "change",
      () => createSceneFourChart(preparedHousingData)
    );

    const textElement = document.createElement("span");
    textElement.textContent = metric.label;

    labelElement.append(
      checkboxElement,
      textElement
    );

    checkboxContainer.appendChild(labelElement);
  });

  document
    .getElementById("reset-metrics-button")
    .addEventListener("click", () => {
      checkboxContainer
        .querySelectorAll('input[type="checkbox"]')
        .forEach((checkbox, checkboxIndex) => {
          checkbox.checked = checkboxIndex < 2;
        });

      createSceneFourChart(preparedHousingData);
    });
}

/*
 * Return the keys for the currently selected Scene 4 metrics.
 */
function getSelectedMetricKeys() {
  return Array.from(
    document.querySelectorAll(
      '#metric-checkboxes input[type="checkbox"]:checked'
    )
  ).map(checkbox => checkbox.value);
}

/*
 * Scene 4:
 * Index selected measures to 100 for a same-scale comparison.
 */
function createSceneFourChart(data) {
  const {
    chartContainer,
    width,
    height
  } = prepareChartContainer("scene-4-chart");

  const selectedMetricKeys = getSelectedMetricKeys();
  const selectionMessage =
    document.getElementById("scene-4-selection-message");

  if (selectedMetricKeys.length === 0) {
    chartContainer.innerHTML =
      '<div class="empty-chart-message">Select at least one dataset to draw the chart.</div>';

    selectionMessage.textContent =
      "Select at least one dataset.";

    return;
  }

  const selectedMetrics = selectedMetricKeys.map(metricKey =>
    explorerMetrics.find(metric => metric.key === metricKey)
  );

  selectionMessage.textContent =
    `${selectedMetrics.length} dataset${
      selectedMetrics.length === 1 ? "" : "s"
    } selected.`;

  const indexedSeries = selectedMetrics.map(
    (metric, metricIndex) => {
      const validRecords = data.filter(record =>
        isFiniteNumber(record[metric.key])
      );

      const firstValue =
        validRecords.length > 0
          ? validRecords[0][metric.key]
          : null;

      const values = validRecords.map(record => ({
        year: record.year,
        indexedValue:
          firstValue !== 0
            ? (record[metric.key] / firstValue) * 100
            : null,
        originalValue: record[metric.key]
      }));

      return {
        ...metric,
        color:
          explorerLineColors[
            metricIndex % explorerLineColors.length
          ],
        values
      };
    }
  );

  const allIndexedValues = indexedSeries.flatMap(series =>
    series.values
      .map(record => record.indexedValue)
      .filter(isFiniteNumber)
  );

  const indexedExtent = d3.extent(allIndexedValues);

  const margin = {
    top: 35,
    right: 35,
    bottom: 65,
    left: 70
  };

  const {
    plotGroup,
    innerWidth,
    innerHeight
  } = createChartFrame(
    chartContainer,
    width,
    height,
    margin
  );

  const yearScale = d3
    .scaleLinear()
    .domain(d3.extent(data, record => record.year))
    .range([0, innerWidth]);

  const valueScale = d3
    .scaleLinear()
    .domain([
      indexedExtent[0] * 0.94,
      indexedExtent[1] * 1.06
    ])
    .nice()
    .range([innerHeight, 0]);

  addHorizontalGrid(plotGroup, valueScale, innerWidth);

  plotGroup
    .append("line")
    .attr("class", "zero-line")
    .attr("x1", 0)
    .attr("x2", innerWidth)
    .attr("y1", valueScale(100))
    .attr("y2", valueScale(100));

  plotGroup
    .append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0, ${innerHeight})`)
    .call(
      d3.axisBottom(yearScale)
        .ticks(data.length)
        .tickFormat(d3.format("d"))
    );

  plotGroup
    .append("g")
    .attr("class", "axis")
    .call(
      d3.axisLeft(valueScale)
        .ticks(7)
        .tickFormat(value => d3.format(".0f")(value))
    );

  addAxisLabels(
    plotGroup,
    innerWidth,
    innerHeight,
    "Year",
    "Index, first value = 100"
  );

  const lineGenerator = d3
    .line()
    .defined(record => isFiniteNumber(record.indexedValue))
    .x(record => yearScale(record.year))
    .y(record => valueScale(record.indexedValue))
    .curve(d3.curveMonotoneX);

  indexedSeries.forEach(series => {
    plotGroup
      .append("path")
      .datum(series.values)
      .attr("fill", "none")
      .attr("stroke", series.color)
      .attr("stroke-width", 3)
      .attr("d", lineGenerator);

    plotGroup
      .selectAll(`.point-${series.key}`)
      .data(
        series.values.filter(record =>
          isFiniteNumber(record.indexedValue)
        )
      )
      .join("circle")
      .attr("class", `point-${series.key}`)
      .attr("cx", record => yearScale(record.year))
      .attr("cy", record => valueScale(record.indexedValue))
      .attr("r", 4)
      .attr("fill", series.color)
      .attr("stroke", "white")
      .attr("stroke-width", 1.5)
      .on("mouseenter", function (event, record) {
        showTooltip(
          event,
          `<strong>${record.year}: ${series.label}</strong>
           Original value: ${series.formatter(
             record.originalValue
           )}<br>
           Indexed value: ${d3.format(".1f")(
             record.indexedValue
           )}`
        );
      })
      .on("mousemove", moveTooltip)
      .on("mouseleave", hideTooltip);
  });

  createExplorerLegend(
    chartContainer,
    indexedSeries
  );
}

/*
 * Add a small legend beneath the Scene 4 chart.
 */
function createExplorerLegend(chartContainer, indexedSeries) {
  const legendContainer = document.createElement("div");
  legendContainer.className = "legend";
  legendContainer.style.justifyContent = "flex-start";
  legendContainer.style.marginTop = "0.7rem";

  indexedSeries.forEach(series => {
    const legendItem = document.createElement("span");
    const legendSwatch = document.createElement("i");

    legendSwatch.className = "legend-swatch";
    legendSwatch.style.background = series.color;

    legendItem.append(
      legendSwatch,
      document.createTextNode(series.label)
    );

    legendContainer.appendChild(legendItem);
  });

  chartContainer.appendChild(legendContainer);
}

/*
 * Add horizontal grid lines based on a vertical scale.
 */
function addHorizontalGrid(plotGroup, valueScale, innerWidth) {
  plotGroup
    .append("g")
    .attr("class", "grid")
    .call(
      d3.axisLeft(valueScale)
        .ticks(6)
        .tickSize(-innerWidth)
        .tickFormat("")
    );
}

/*
 * Add standard horizontal and vertical axis labels.
 */
function addAxisLabels(
  plotGroup,
  innerWidth,
  innerHeight,
  horizontalLabel,
  verticalLabel
) {
  plotGroup
    .append("text")
    .attr("class", "axis-label")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 52)
    .attr("text-anchor", "middle")
    .text(horizontalLabel);

  plotGroup
    .append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -52)
    .attr("text-anchor", "middle")
    .text(verticalLabel);
}

/*
 * Add interactive circles to a line chart.
 */
function addLinePoints(
  plotGroup,
  data,
  horizontalPosition,
  verticalPosition,
  color,
  mouseEnterHandler
) {
  plotGroup
    .selectAll(null)
    .data(data)
    .join("circle")
    .attr("cx", horizontalPosition)
    .attr("cy", verticalPosition)
    .attr("r", 5)
    .attr("fill", color)
    .attr("stroke", "white")
    .attr("stroke-width", 2)
    .on("mouseenter", mouseEnterHandler)
    .on("mousemove", moveTooltip)
    .on("mouseleave", hideTooltip);
}

/*
 * Add a label beside the final point in a dual-line chart.
 */
function addDirectLineLabel(
  plotGroup,
  record,
  horizontalScale,
  verticalScale,
  valueField,
  label,
  color,
  verticalOffset
) {
  plotGroup
    .append("text")
    .attr("class", "chart-annotation")
    .attr("x", horizontalScale(record.year) - 4)
    .attr("y", verticalScale(record[valueField]) + verticalOffset)
    .attr("text-anchor", "end")
    .attr("fill", color)
    .text(label);
}

/*
 * Tooltip functions shared by all charts.
 */
function showTooltip(event, htmlContent) {
  d3.select("#chart-tooltip")
    .classed("visible", true)
    .html(htmlContent);

  moveTooltip(event);
}

function moveTooltip(event) {
  const tooltip = d3.select("#chart-tooltip");
  const tooltipNode = tooltip.node();

  const proposedLeft = event.pageX + 14;
  const proposedTop = event.pageY - 45;

  const maximumLeft =
    window.scrollX +
    document.documentElement.clientWidth -
    tooltipNode.offsetWidth -
    12;

  tooltip
    .style(
      "left",
      `${Math.min(proposedLeft, maximumLeft)}px`
    )
    .style(
      "top",
      `${Math.max(proposedTop, window.scrollY + 8)}px`
    );
}

function hideTooltip() {
  d3.select("#chart-tooltip")
    .classed("visible", false);
}

/*
 * Format signed values for readable tooltips and annotations.
 */
function formatSignedNumber(value) {
  if (!isFiniteNumber(value)) {
    return "Not available";
  }

  return d3.format("+,.0f")(value);
}

function formatSignedPercent(value) {
  if (!isFiniteNumber(value)) {
    return "Not available";
  }

  return `${d3.format("+.1f")(value)}%`;
}

/*
 * Redraw charts after resizing stops.
 * Waiting briefly avoids redrawing dozens of times during one resize.
 */
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);

  resizeTimer = setTimeout(() => {
    if (preparedHousingData.length > 0) {
      renderAllScenes();
    }
  }, 180);
});
