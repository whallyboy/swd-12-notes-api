import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../src/app.js";

const BASE = "/api";

test("register + login + me", async () => {
  const email = `u${Date.now()}@example.com`;
  const reg = await request(app).post(`${BASE}/auth/register`).send({ name: "U", email, password: "password123" });
  assert.equal(reg.status, 201);
  assert.ok(reg.body.token);
  assert.ok(!reg.body.user.password_hash);

  const login = await request(app).post(`${BASE}/auth/login`).send({ email, password: "password123" });
  assert.equal(login.status, 200);
  const token = login.body.token;

  const me = await request(app).get(`${BASE}/auth/me`).set("Authorization", `Bearer ${token}`);
  assert.equal(me.status, 200);
  assert.equal(me.body.user.email, email.toLowerCase());
});

test("auth required", async () => {
  const r = await request(app).get(`${BASE}/notes`);
  assert.equal(r.status, 401);
});

test("ownership: cannot access another user's note", async () => {
  const a = `a${Date.now()}@example.com`;
  const b = `b${Date.now()}@example.com`;
  const ra = await request(app).post(`${BASE}/auth/register`).send({ name: "A", email: a, password: "password123" });
  const rb = await request(app).post(`${BASE}/auth/register`).send({ name: "B", email: b, password: "password123" });
  const note = await request(app).post(`${BASE}/notes`).set("Authorization", `Bearer ${ra.body.token}`).send({ title: "secret" });
  const id = note.body.data.id;
  const r = await request(app).get(`${BASE}/notes/${id}`).set("Authorization", `Bearer ${rb.body.token}`);
  assert.equal(r.status, 404);
});
