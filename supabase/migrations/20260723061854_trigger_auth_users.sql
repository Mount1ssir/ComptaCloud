CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, role, tenant_id)
  VALUES (
    new.id,
    new.email,
    COALESCE((new.raw_user_meta_data->>'role')::public.user_role, 'client'::public.user_role),
    (new.raw_user_meta_data->>'tenant_id')::uuid
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
