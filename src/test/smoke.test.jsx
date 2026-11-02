import { screen } from "@testing-library/react";
import { installFakeApi } from "./fakeApi";
import { renderApp, loginAs, CREDENTIALS } from "./renderApp";

test("smoke: el vecino ingresa y ve su portal", async () => {
  installFakeApi();
  const { user } = renderApp();
  await loginAs(user, ...CREDENTIALS.ciudadano);
  expect(await screen.findByText(/Mi Tránsito UADE/i)).toBeInTheDocument();
});
