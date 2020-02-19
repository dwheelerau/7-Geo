async function drawMap() {
  // load up shapefile and dataset from World Bank
  const countryShapes = await d3.json("../world-geojson.json")
  const dataset = await d3.csv("../data_bank_data.csv")
  // accessor functions for key data in shapefile
  const countryNameAccessor = d => d.properties["NAME"]
  const countryIdAccessor = d => d.properties["ADM0_A3_IS"]
  // set the metric we are interested in from the CSV file
  const metric = "Population growth (annual %)"
  // an object to store country IDs as keys and pop as vals
  let metricDataByCountry = {}
  // if series name not metric pass (ie return) otherwise set the data based on
  // population growth rate
  dataset.forEach(d => {
    if (d["Series Name"] != metric) return
    metricDataByCountry[d["Country Code"]] 
        = +d["2017 [YR2017]"] || 0 })
  // we want our chart 90% the width of the window
  let dimensions = {
    width: window.innerWidth * 0.9,
    margin: {
      top: 10,
      right: 10,
      bottom: 10,
      left: 10,
    },
  }
  dimensions.boundedWidth = dimensions.width
    - dimensions.margin.left
    - dimensions.margin.right
  // won't set height just yet as will be dependent on map projection
  // this is just a mock geojoson keyword we can use to get a
  // sphere projection (new feature added in)
  const sphere = ({type: "Sphere"})
  // create our projecton object and set it to our width
  const projection = d3.geoEqualEarth()
    .fitWidth(dimensions.boundedWidth, sphere)
  // get our paths that will define our global projection
  const pathGenerator = d3.geoPath(projection)
  // get the bounds of the sphere for dimensions setting
  //console.log(pathGenerator.bounds(sphere))
  //0: (2) [0, 2.842170943040401e-14]
  //1: (2) [862.9, 419.98807806179127]
  const [[x0, y0], [x1, y1]] = pathGenerator.bounds(sphere)
  // console.log(y1) // 419.98807806179127
  dimensions.boundedHeight = y1
  dimensions.height = dimensions.boundedHeight
    + dimensions.margin.top
    + dimensions.margin.bottom
  // set up the wrapper svg and bounds group
  const wrapper = d3.select("#wrapper")
    .append("svg")
    .attr("width", dimensions.width)
    .attr("height", dimensions.height)
  const bounds = wrapper.append("g")
    .style("transform", `translate(${dimensions.margin.left}px,
    ${dimensions.margin.top}px)`)
  // create our scale for population
  const metricValues = Object.values(metricDataByCountry)
  const metricValueExtent = d3.extent(metricValues)
  // console.log(metricValueExtent)
  // [-2.05660023263167, 4.669194641437
  // create our range -2 (red) 0 (white) 5 (green)
  // find the max change in both directions, here our +4.9 is the max
  const maxChange = d3.max([-metricValueExtent[0], metricValueExtent[1]])
  // console.log(maxChange)
  // 4.669194641437
  // This scale is -4.6,0,4.6 due to the maxChange variable
  const colorScale = d3.scaleLinear()
    .domain([-maxChange, 0, maxChange])
    .range(["indigo", "white", "darkgreen"]) // colorblind friendly
  // setup the projections
  const earth = bounds.append("path")
    .attr("class", "earth")
    .attr("d", pathGenerator(sphere))
  const graticuleJson = d3.geoGraticule10()
  const graticule = bounds.append("path")
    .attr("class", "graticule")
    .attr("d", pathGenerator(graticuleJson))
  const countries = bounds.selectAll(".country")
    .data(countryShapes.features)
    .enter().append("path")
    .attr("class", "country")
    .attr("d", pathGenerator)
		.attr("fill", d => {
      console.log(d)
        const metricValue = metricDataByCountry[countryIdAccessor(d)]
        if (typeof metricValue == "undefined") return "#e2e6e9"
        return colorScale(metricValue)
      })
  const legendGroup = wrapper.append("g")
    .attr("transform", `translate(${
    120
    }, ${
    dimensions.width < 800
    ? dimensions.boundedHeight - 30
        : dimensions.boundedHeight * 0.5
        })`)
  const legendTitle = legendGroup.append("text")
    .attr("y", -23)
    .attr("class", "legend-title")
    .text("Population growth")
  const legendByLine = legendGroup.append("text")
    .attr("y", -9)
    .attr("class", "legend-byline")
  .text("Percent change in 2017")
  // create a SVG defs element to store our color key
  const defs = wrapper.append("defs")
  const legendGradientId = "legend-gradient"
  const gradient = defs.append("linearGradient")
    .attr("id", legendGradientId)
    .selectAll("stop")
    .data(colorScale.range())
    .enter().append("stop")
    .attr("stop-color", d => d)
    .attr("offset", (d, i) => `${
    i * 100 / 2 // 2 is one less than our arrays length
    }%`)
  const legendWidth = 120
  const legendHeight = 16
  const legendGradient = legendGroup.append("rect")
    .attr("x", -legendWidth / 2)
    .attr("height", legendHeight)
    .attr("width", legendWidth)
    .style("fill", `url(#${legendGradientId})`)
 const legendValueRight = legendGroup.append("text")
    .attr("class", "legend-value")
    .attr("x", legendWidth / 2 + 10)
    .attr("y", legendHeight / 2)
    .text(`${d3.format(".1f")(maxChange)}%`)
  const legendValueLeft = legendGroup.append("text")
    .attr("class", "legend-value")
    .attr("x", -legendWidth / 2 - 10)
    .attr("y", legendHeight / 2)
    .text(`${d3.format(".1f")(-maxChange)}%`)
    .style("text-anchor", "end")
  navigator.geolocation.getCurrentPosition(myPosition => {
    console.log(myPosition)
    const [x, y] = projection([
      myPosition.coords.longitude,
      myPosition.coords.latitude
    ])
    const myLocation = bounds.append("circle")
      .attr("class", "my-location")
      .attr("cx", x)
      .attr("cy", y)
      .attr("r", 0)
      .transition().duration(500)
      .attr("r", 5)
  })
  countries.on("mouseenter", onMouseEnter)
    .on("mouseleave", onMouseLeave)

  const tooltip = d3.select("#tooltip")
  function onMouseEnter(datum) {
    tooltip.style("opacity", 1)
    const metricValue = metricDataByCountry[countryIdAccessor(datum)]
    tooltip.select("#country")
      .text(countryNameAccessor(datum))
    tooltip.select("#value")
    .text(`${d3.format(",.2f")(metricValue || 0)}%`)
    const [centerX, centerY] = pathGenerator.centroid(datum)
    const x = centerX + dimensions.margin.left
    const y = centerY + dimensions.margin.top

    tooltip.style("transform", `translate(`
      + `calc( -50% + ${x}px),`
      + `calc(-100% + ${y}px)`
      +`)`)
  }
  function onMouseLeave() {
    tooltip.style("opacity", 0)
  }

}
drawMap()

