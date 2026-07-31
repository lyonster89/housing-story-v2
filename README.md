# Housing Pressure Narrative Visualization

This project is a four-scene interactive D3 visualization examining whether housing supply has kept up with household growth and how mortgage rates affect affordability.

## Project structure

```text
housing-pressure-visualization/
├── index.html
├── style.css
├── script.js
├── README.md
└── data/
    └── processed/
        └── housing_pressure_last_10_years.json
```

## Scenes

### Scene 1: Household growth versus new housing

This scene compares:

- New households formed each year
- Newly completed housing units
- The annual difference between housing completions and new households

The calculation is:

```text
annual housing gap =
housing completions - new households
```

A positive value means completions exceeded household growth. A negative value means household growth exceeded completions.

### Scene 2: Mortgage-rate effects

This scene shows:

- Average 30-year mortgage APR for each year
- Monthly principal-and-interest payment on a $200,000 mortgage
- A comparison between the lowest and highest calculated payment

The mortgage uses:

- Loan amount: $200,000
- Loan term: 30 years
- Number of monthly payments: 360
- Annual mortgage rate from the dataset

Taxes, homeowners insurance, mortgage insurance, and association fees are not included.

### Scene 3: Income growth versus mortgage-payment growth

This scene compares:

- Annual median household-income growth
- Annual growth in the payment on the fixed $200,000 mortgage

Income data currently ends in 2024, so this comparison does not include 2025.

### Scene 4: Interactive comparison

Users can select:

- Total households
- New households
- Median household income
- Mortgage APR
- Monthly payment on a $200,000 mortgage
- Annual mortgage payment as a percentage of median household income

Because these variables use different units, each selected measure is indexed to 100 in its first available year.

## How the JavaScript is organized

`script.js` follows this sequence:

1. Load the JSON file.
2. Validate the required fields.
3. Calculate derived variables.
4. Draw all four scenes.
5. Redraw the charts when the browser is resized.

Important calculated fields include:

```text
new households =
current total households - previous total households
```

```text
housing gap =
housing completions - new households
```

```text
annual mortgage cost =
monthly mortgage payment * 12
```

```text
mortgage cost as a percentage of income =
annual mortgage cost / median household income * 100
```

## Run the project locally

The data is loaded with JavaScript, so use a local web server instead of opening `index.html` directly.

### Python

Open a terminal in the project folder and run:

```bash
python -m http.server 8000
```

Then visit:

```text
http://localhost:8000
```

### Visual Studio Code

1. Open the project folder.
2. Install the Live Server extension.
3. Right-click `index.html`.
4. Select **Open with Live Server**.

## Data requirements

The website expects this file:

```text
data/processed/housing_pressure_last_10_years.json
```

The JSON must contain annual records with these source fields:

```text
year
total_households_thousands
housing_completions_thousands
mortgage_rate_percent
median_household_income_dollars
income_growth_percent
```

The remaining values are calculated by `script.js`.

## Important limitations

- Housing completions are used as a national approximation of new housing becoming available.
- Completed housing is not necessarily located where household demand is strongest.
- Mortgage payments represent principal and interest only.
- The fixed $200,000 loan isolates interest-rate effects and does not represent changes in home prices.
- National figures do not describe every local housing market.
