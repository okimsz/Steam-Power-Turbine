const descriptions = {
  turbine: {
    index: "02",
    title: "Six-stage axial turbine",
    description:
      "Fixed guide vanes direct steam onto rotating blades. Successive rows expand the flow and transfer energy to a common shaft.",
    type: "MECHANICAL WORK",
    target: [-0.7, 2, 0],
    radius: 10.5,
  },
  generator: {
    index: "02",
    title: "Shaft-coupled generator",
    description:
      "The turbine and generator rotate together. A two-pole rotor at 3,000 rpm corresponds to a nominal electrical frequency of 50 Hz.",
    type: "ELECTRICAL OUTPUT",
    target: [3.7, 1.9, 0],
    radius: 8,
  },
  boiler: {
    index: "01",
    title: "Steam generator",
    description:
      "Heat raises feedwater to boiling and then superheats the steam. The inlet temperature and pressure controls set the turbine supply conditions.",
    type: "HEAT ADDITION",
    target: [-4.4, 2, 0],
    radius: 10,
  },
  condenser: {
    index: "03",
    title: "Surface condenser",
    description:
      "Cooling water removes heat from turbine exhaust. Steam condenses at low pressure, sustaining the pressure drop through the turbine.",
    type: "HEAT REJECTION",
    target: [0.1, 0.8, 2.4],
    radius: 9,
  },
  pump: {
    index: "04",
    title: "Feedwater pump",
    description:
      "The pump raises liquid-water pressure for its return to the boiler. Pump work is much smaller than turbine output because liquid has a low specific volume.",
    type: "PRESSURE RECOVERY",
    target: [-3.6, 0.9, 2.3],
    radius: 8,
  },
};
export { descriptions };
